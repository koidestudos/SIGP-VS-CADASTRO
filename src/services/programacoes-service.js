import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, setDoc, getDoc, writeBatch, getDocs, query, where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { isBootstrapAdminEmail } from '../config/admins.js';
import { setUserRole } from './roles.js';
import { getUserRole } from './roles.js';
import { notifyProgramacaoPendente } from './notifications-service.js';

const SEED_IMPORT_KEY = 'sigp-seed-xlsx-v5';
const MIN_PROGRAMACAO_DATE = '2026-07-01';
const BATCH_SIZE = 400;
let SEED_COUNT = 135;
export let seedImportInProgress = false;

async function loadSeedData() {
  const mod = await import('../data/programacoes-viagens-xlsx.json');
  return mod.default;
}

let programacoesCache = [];
let logisticaCache = [];
const progListeners = new Set();
const logListeners = new Set();
let unsubProg = null;
let unsubLog = null;

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase não configurado. Defina as variáveis VITE_FIREBASE_* no .env');
  }
  return db;
}

function requireUser() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');
  return uid;
}

function isProgramacaoVisible(p) {
  return !p.dataInicial || p.dataInicial >= MIN_PROGRAMACAO_DATE;
}

function visibleProgramacoes(list = programacoesCache) {
  return list.filter(isProgramacaoVisible);
}

function notifyProg() {
  if (seedImportInProgress) return;
  progListeners.forEach((fn) => fn(visibleProgramacoes()));
}

function notifyLog() {
  if (seedImportInProgress) return;
  logListeners.forEach((fn) => fn([...logisticaCache]));
}

export function subscribeProgramacoes(callback) {
  progListeners.add(callback);
  callback(visibleProgramacoes());
  return () => progListeners.delete(callback);
}

export function subscribeLogistica(callback) {
  logListeners.add(callback);
  callback([...logisticaCache]);
  return () => logListeners.delete(callback);
}

export function getProgramacoes() {
  return visibleProgramacoes();
}

export function getLogistica() {
  return [...logisticaCache];
}

export function getProgramacaoById(id) {
  const p = programacoesCache.find((item) => item.id === id) || null;
  return p && isProgramacaoVisible(p) ? p : null;
}

export function getProgramacaoRawById(id) {
  return programacoesCache.find((item) => item.id === id) || null;
}

export function initProgramacoesSync() {
  const database = requireDb();

  if (unsubProg) unsubProg();
  if (unsubLog) unsubLog();

  unsubProg = onSnapshot(collection(database, 'programacoes'), (snap) => {
    programacoesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notifyProg();
  });

  unsubLog = onSnapshot(collection(database, 'logistica'), (snap) => {
    logisticaCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notifyLog();
  });
}

function sanitizeProgramacao(data, uid, isNew) {
  const allowed = {
    titulo: data.titulo || '',
    tipoAtividade: data.tipoAtividade || '',
    coordenacaoId: data.coordenacaoId || '',
    responsavel: data.responsavel || '',
    objetivo: data.objetivo || '',
    publicoAlvo: data.publicoAlvo || '',
    semana: data.semana || '',
    dataInicial: data.dataInicial || '',
    dataFinal: data.dataFinal || '',
    duracao: data.duracao || '',
    regionalId: data.regionalId || '',
    municipioId: data.municipioId || '',
    localAtividade: data.localAtividade || '',
    necessitaTransporte: Boolean(data.necessitaTransporte),
    necessitaAlimentacao: Boolean(data.necessitaAlimentacao),
    obsLogistica: data.obsLogistica || '',
    equipe: Array.isArray(data.equipe) ? data.equipe.slice(0, 50) : [],
    codigoOrcamentario: data.codigoOrcamentario || '',
    fonteRecurso: data.fonteRecurso || '',
    observacoes: data.observacoes || '',
    status: data.status || 'Rascunho',
    criadoPor: isNew ? uid : (data.criadoPor || uid),
    atualizadoEm: new Date().toISOString(),
  };
  if (isNew) {
    allowed.criadoEm = new Date().toISOString();
  }
  return allowed;
}

export async function saveProgramacao(data, existingId = null) {
  const database = requireDb();
  const uid = requireUser();
  const previous = existingId ? programacoesCache.find((p) => p.id === existingId) : null;

  if (existingId && previous) {
    const isOwner = previous.criadoPor === uid;
    const isAdmin = getUserRole() === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Você só pode editar suas próprias programações.');
    }
  }

  const payload = sanitizeProgramacao(data, uid, !existingId);
  const wasPending = previous?.status === 'Pendente';

  if (existingId) {
    await updateDoc(doc(database, 'programacoes', existingId), payload);
    const saved = { id: existingId, ...payload };
    await syncLogisticaToFirestore(saved);
    if (payload.status === 'Pendente' && !wasPending) {
      await notifyProgramacaoPendente(saved);
    }
    return saved;
  }

  const { criadoEm, ...createPayload } = payload;
  const ref = await addDoc(collection(database, 'programacoes'), {
    ...createPayload,
    criadoEm: serverTimestamp(),
  });
  const saved = { id: ref.id, ...payload };
  await syncLogisticaToFirestore(saved);
  if (payload.status === 'Pendente') {
    await notifyProgramacaoPendente(saved);
  }
  return saved;
}

export async function removeProgramacao(id) {
  const database = requireDb();
  requireUser();
  await deleteDoc(doc(database, 'programacoes', id));
  const logItem = logisticaCache.find((l) => l.programacaoId === id);
  if (logItem) await deleteDoc(doc(database, 'logistica', logItem.id));
}

export async function approveProgramacao(id) {
  const prog = getProgramacaoById(id);
  if (!prog) return null;
  return saveProgramacao({ ...prog, status: 'Aprovado', aprovadoEm: new Date().toISOString() }, id);
}

async function syncLogisticaToFirestore(programacao) {
  if (!programacao.necessitaTransporte && !programacao.necessitaAlimentacao) return;

  const database = requireDb();
  const existing = logisticaCache.find((l) => l.programacaoId === programacao.id);
  const entry = {
    programacaoId: programacao.id,
    municipioId: programacao.municipioId || '',
    transporte: Boolean(programacao.necessitaTransporte),
    alimentacao: Boolean(programacao.necessitaAlimentacao),
    situacao: existing?.situacao || 'Solicitado',
    atualizadoEm: new Date().toISOString(),
  };

  if (existing) {
    await updateDoc(doc(database, 'logistica', existing.id), entry);
  } else {
    await addDoc(collection(database, 'logistica'), entry);
  }
}

export async function updateLogisticaSituacao(id, situacao) {
  const database = requireDb();
  requireUser();
  await updateDoc(doc(database, 'logistica', id), {
    situacao,
    atualizadoEm: new Date().toISOString(),
  });
}

export function syncLogisticaFromProgramacao(programacao) {
  return syncLogisticaToFirestore(programacao);
}

/** Salva perfil mínimo do usuário (somente o próprio uid) */
export async function upsertUserProfile(user) {
  if (!db || !user?.uid) return;
  const payload = {
    nome: user.nome || '',
    email: user.email || '',
    atualizadoEm: new Date().toISOString(),
  };
  if (isBootstrapAdminEmail(user.email)) {
    payload.role = 'admin';
  }
  await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
}

/** Carrega papel do usuário e mantém sincronizado */
export function subscribeUserRole(uid, callback) {
  if (!db || !uid) {
    callback('usuario');
    return () => {};
  }
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const role = snap.exists() && snap.data().role === 'admin' ? 'admin' : 'usuario';
    setUserRole(role);
    callback(role);
  }, () => {
    setUserRole('usuario');
    callback('usuario');
  });
}

export async function fetchUserRole(uid) {
  if (!db || !uid) return 'usuario';
  const snap = await getDoc(doc(db, 'users', uid));
  const role = snap.exists() && snap.data().role === 'admin' ? 'admin' : 'usuario';
  setUserRole(role);
  return role;
}

/** Remove programações e logística associada em lotes */
async function batchDeleteProgramacoes(items) {
  if (!items.length) return 0;
  const database = requireDb();
  const logByProg = new Map(logisticaCache.map((l) => [l.programacaoId, l.id]));
  let deleted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(database);
    for (const p of chunk) {
      batch.delete(doc(database, 'programacoes', p.id));
      const logId = logByProg.get(p.id);
      if (logId) batch.delete(doc(database, 'logistica', logId));
    }
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

/** Apaga do Firestore tudo anterior a jul/2026 e seeds obsoletos */
export async function purgeOutdatedProgramacoes(validSeedIds = new Set()) {
  const database = requireDb();
  requireUser();

  const toDelete = new Map();

  const oldSnap = await getDocs(
    query(collection(database, 'programacoes'), where('dataInicial', '<', MIN_PROGRAMACAO_DATE)),
  );
  oldSnap.docs.forEach((d) => toDelete.set(d.id, { id: d.id, ...d.data() }));

  programacoesCache.forEach((p) => {
    if (!isProgramacaoVisible(p)) toDelete.set(p.id, p);
    if ((p.id.startsWith('xls-') || p.id.startsWith('pdf-gas-')) && !validSeedIds.has(p.id)) {
      toDelete.set(p.id, p);
    }
  });

  return batchDeleteProgramacoes([...toDelete.values()]);
}

/** Importa programações da planilha Excel (GAS/GAP/GVS) para o Firestore */
export async function importProgramacoesSeed({ force = false } = {}) {
  const database = requireDb();
  const uid = requireUser();
  const SEED_PROGRAMACOES = await loadSeedData();
  SEED_COUNT = SEED_PROGRAMACOES.length;
  const newIds = new Set(SEED_PROGRAMACOES.map((p) => p.id));

  seedImportInProgress = true;
  try {
    const deleted = await purgeOutdatedProgramacoes(newIds);

    if (!force && localStorage.getItem(SEED_IMPORT_KEY) === 'done') {
      return { skipped: true, count: 0, deleted };
    }

    for (let i = 0; i < SEED_PROGRAMACOES.length; i += BATCH_SIZE) {
      const chunk = SEED_PROGRAMACOES.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(database);
      for (const item of chunk) {
        const payload = sanitizeProgramacao({ ...item, status: item.status || 'Programada' }, uid, true);
        batch.set(doc(database, 'programacoes', item.id), {
          ...payload,
          criadoEm: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
    }

    let logBatch = writeBatch(database);
    let logOps = 0;
    for (const item of SEED_PROGRAMACOES) {
      if (!item.necessitaTransporte && !item.necessitaAlimentacao) continue;
      const entry = {
        programacaoId: item.id,
        municipioId: item.municipioId || '',
        transporte: Boolean(item.necessitaTransporte),
        alimentacao: Boolean(item.necessitaAlimentacao),
        situacao: 'Solicitado',
        atualizadoEm: new Date().toISOString(),
      };
      const existing = logisticaCache.find((l) => l.programacaoId === item.id);
      const ref = existing
        ? doc(database, 'logistica', existing.id)
        : doc(collection(database, 'logistica'));
      logBatch.set(ref, entry, { merge: true });
      logOps += 1;
      if (logOps >= BATCH_SIZE) {
        await logBatch.commit();
        logBatch = writeBatch(database);
        logOps = 0;
      }
    }
    if (logOps > 0) await logBatch.commit();

    localStorage.setItem(SEED_IMPORT_KEY, 'done');
    return { skipped: false, count: SEED_PROGRAMACOES.length, deleted };
  } finally {
    seedImportInProgress = false;
    notifyProg();
    notifyLog();
  }
}

export function getSeedProgramacoesCount() {
  return SEED_COUNT;
}
