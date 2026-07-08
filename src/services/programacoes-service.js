import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, setDoc, getDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { isBootstrapAdminEmail } from '../config/admins.js';
import { setUserRole } from './roles.js';

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

function notifyProg() {
  progListeners.forEach((fn) => fn([...programacoesCache]));
}

function notifyLog() {
  logListeners.forEach((fn) => fn([...logisticaCache]));
}

export function subscribeProgramacoes(callback) {
  progListeners.add(callback);
  callback([...programacoesCache]);
  return () => progListeners.delete(callback);
}

export function subscribeLogistica(callback) {
  logListeners.add(callback);
  callback([...logisticaCache]);
  return () => logListeners.delete(callback);
}

export function getProgramacoes() {
  return [...programacoesCache];
}

export function getLogistica() {
  return [...logisticaCache];
}

export function getProgramacaoById(id) {
  return programacoesCache.find((p) => p.id === id) || null;
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
  const payload = sanitizeProgramacao(data, uid, !existingId);

  if (existingId) {
    await updateDoc(doc(database, 'programacoes', existingId), payload);
    const saved = { id: existingId, ...payload };
    await syncLogisticaToFirestore(saved);
    return saved;
  }

  const { criadoEm, ...createPayload } = payload;
  const ref = await addDoc(collection(database, 'programacoes'), {
    ...createPayload,
    criadoEm: serverTimestamp(),
  });
  const saved = { id: ref.id, ...payload };
  await syncLogisticaToFirestore(saved);
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
  return saveProgramacao({ ...prog, status: 'Publicada', aprovadoEm: new Date().toISOString() }, id);
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
