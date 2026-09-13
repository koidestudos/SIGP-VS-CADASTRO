import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, setDoc, getDoc, writeBatch, getDocs, query, where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';
import { isBootstrapAdminEmail } from '../config/admins.js';
import { setUserRole, getUserRole, getUserGerencia, normalizeRole, normalizeGerencia } from './roles.js';
import { notifyProgramacaoEnviada, notifyProgramacaoDevolvida, notifyProgramacaoAprovada } from './notifications-service.js';
import { getUsers } from './users-service.js';
import {
  normalizeStatus, canAttachAnexo,
  STATUS_AGUARDANDO_GERENCIA, STATUS_DEVOLVIDA, STATUS_REENVIADA, STATUS_APROVADA_GERENCIA,
  isPendenteGerencia,
} from '../utils/status.js';
import { getCoordenacaoById } from '../data/seed.js';
import { appendHistorico, makeHistoricoEntry, currentActorMeta } from '../utils/programacao-historico.js';

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

export function formatProgramacaoError(err, fallback = 'Erro ao salvar programação.') {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  if (code === 'permission-denied' || /insufficient permissions|permission/i.test(msg)) {
    return 'Sem permissão para salvar agora. Confirme que está logada e tente de novo em alguns segundos.';
  }
  if (code === 'unauthenticated') {
    return 'Sessão expirada. Faça login novamente e tente de novo.';
  }
  return err?.message || fallback;
}

function requireUser() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');
  return uid;
}

function currentAuthorMeta() {
  const u = auth?.currentUser;
  return {
    nome: String(u?.displayName || u?.email?.split('@')[0] || 'Usuário').slice(0, 200),
    email: String(u?.email || '').slice(0, 320),
  };
}

function resolveAuthorMeta(data, uid, isNew) {
  const me = currentAuthorMeta();
  const authorUid = isNew ? uid : (data.criadoPor || uid);
  let nome = isNew ? me.nome : String(data.criadoPorNome || '').trim();
  let email = isNew ? me.email : String(data.criadoPorEmail || '').trim();

  if (!isNew && (!nome || !email)) {
    if (authorUid === uid) {
      if (!nome) nome = me.nome;
      if (!email) email = me.email;
    } else {
      const other = getUsers().find((u) => u.id === authorUid);
      if (other) {
        if (!nome) nome = String(other.nome || other.email?.split('@')[0] || '').slice(0, 200);
        if (!email) email = String(other.email || '').slice(0, 320);
      }
    }
  }

  return { uid: authorUid, nome, email };
}

function resolveGerenciaFromData(data) {
  const fromCoord = getCoordenacaoById(data?.coordenacaoId)?.gerencia;
  return normalizeGerencia(fromCoord) || normalizeGerencia(data?.gerencia);
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
  return visibleProgramacoes().sort((a, b) => (a.dataInicial || '').localeCompare(b.dataInicial || ''));
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
  const author = resolveAuthorMeta(data, uid, isNew);
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
    regionalId: (Array.isArray(data.regionalIds) && data.regionalIds[0]) || data.regionalId || '',
    regionalIds: Array.isArray(data.regionalIds)
      ? data.regionalIds.filter(Boolean).slice(0, 20)
      : (data.regionalId ? [data.regionalId] : []),
    municipioIds: Array.isArray(data.municipioIds)
      ? data.municipioIds.filter(Boolean).slice(0, 20)
      : (data.municipioId ? [data.municipioId] : []),
    municipioId: (Array.isArray(data.municipioIds) && data.municipioIds[0]) || data.municipioId || '',
    localAtividade: data.localAtividade || '',
    necessitaTransporte: Boolean(data.necessitaTransporte),
    transporteTipo: ['sim', 'microonibus', 'nao'].includes(data.transporteTipo)
      ? data.transporteTipo
      : (data.necessitaTransporte ? 'sim' : 'nao'),
    necessitaAlimentacao: Boolean(data.necessitaAlimentacao),
    obsLogistica: data.obsLogistica || '',
    equipe: Array.isArray(data.equipe) ? data.equipe.slice(0, 50) : [],
    codigoOrcamentario: data.codigoOrcamentario || '',
    fonteRecurso: data.fonteRecurso || '',
    observacoes: data.observacoes || '',
    status: data.status || 'Rascunho',
    gerencia: resolveGerenciaFromData(data),
    criadoPor: author.uid,
    criadoPorNome: author.nome,
    criadoPorEmail: author.email,
    historico: Array.isArray(data.historico) ? data.historico.slice(-50) : [],
    enviadoEm: data.enviadoEm || '',
    enviadoPor: data.enviadoPor || '',
    enviadoPorNome: data.enviadoPorNome || '',
    aprovadoPor: data.aprovadoPor || '',
    aprovadoPorNome: data.aprovadoPorNome || '',
    aprovadoEm: data.aprovadoEm || '',
    devolvidoPor: data.devolvidoPor || '',
    devolvidoPorNome: data.devolvidoPorNome || '',
    devolvidoEm: data.devolvidoEm || '',
    justificativaDevolucao: data.justificativaDevolucao || '',
    atualizadoEm: new Date().toISOString(),
  };
  if (isNew) {
    allowed.criadoEm = new Date().toISOString();
  }
  return allowed;
}

function applyEnvioMetadata(payload, prevStatus, isNew) {
  const actor = currentActorMeta();
  const gerencia = payload.gerencia;
  let next = normalizeStatus(payload.status);
  const prev = normalizeStatus(prevStatus);
  let historico = Array.isArray(payload.historico) ? [...payload.historico] : [];

  if (isNew) {
    historico = appendHistorico(historico, makeHistoricoEntry({
      tipo: 'cadastro',
      statusNovo: next || 'Rascunho',
      gerencia,
    }));
  }

  const sending = next === STATUS_AGUARDANDO_GERENCIA || next === STATUS_REENVIADA;
  if (sending && gerencia && prev !== STATUS_AGUARDANDO_GERENCIA && prev !== STATUS_REENVIADA) {
    const isResend = prev === STATUS_DEVOLVIDA;
    next = isResend ? STATUS_REENVIADA : STATUS_AGUARDANDO_GERENCIA;
    payload.status = next;
    payload.enviadoEm = new Date().toISOString();
    payload.enviadoPor = actor.uid;
    payload.enviadoPorNome = actor.nome;
    if (isResend) payload.justificativaDevolucao = payload.justificativaDevolucao || '';
    historico = appendHistorico(historico, makeHistoricoEntry({
      tipo: isResend ? 'reenvio' : 'envio',
      statusAnterior: prev,
      statusNovo: next,
      gerencia,
    }));
  }

  payload.historico = historico;
  payload.status = next;
  return { notifiedEnvio: sending && prev !== next };
}

export async function saveProgramacao(data, existingId = null) {
  const database = requireDb();
  const uid = requireUser();

  if (existingId) {
    const ref = doc(database, 'programacoes', existingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('Programação não encontrada. Pode ter sido removida por outro usuário.');
    }
    const server = snap.data();
    const isOwner = server.criadoPor === uid;
    const isAdminUser = getUserRole() === 'admin';
    if (!isOwner && !isAdminUser) {
      throw new Error('Você só pode editar suas próprias programações.');
    }
    if (data.baseAtualizadoEm && server.atualizadoEm && data.baseAtualizadoEm !== server.atualizadoEm) {
      throw new Error('Esta programação foi alterada por outra pessoa. Recarregue a página e tente novamente.');
    }

    const payload = sanitizeProgramacao({
      ...server,
      ...data,
      criadoPor: server.criadoPor,
      criadoPorNome: data.criadoPorNome || server.criadoPorNome,
      criadoPorEmail: data.criadoPorEmail || server.criadoPorEmail,
      historico: server.historico,
      enviadoEm: server.enviadoEm,
      enviadoPor: server.enviadoPor,
      enviadoPorNome: server.enviadoPorNome,
      aprovadoPor: server.aprovadoPor,
      aprovadoPorNome: server.aprovadoPorNome,
      aprovadoEm: server.aprovadoEm,
      devolvidoPor: server.devolvidoPor,
      devolvidoPorNome: server.devolvidoPorNome,
      devolvidoEm: server.devolvidoEm,
      justificativaDevolucao: server.justificativaDevolucao,
    }, uid, false);
    const prevStatus = normalizeStatus(server.status);
    const { notifiedEnvio } = applyEnvioMetadata(payload, prevStatus, false);
    const nextStatus = normalizeStatus(payload.status);

    if (nextStatus !== 'Rascunho' && nextStatus !== 'Realizada' && (!payload.equipe || payload.equipe.length < 1)) {
      throw new Error('Informe pelo menos um participante na equipe.');
    }
    if ((nextStatus === STATUS_AGUARDANDO_GERENCIA || nextStatus === STATUS_REENVIADA) && !payload.gerencia) {
      throw new Error('A coordenação precisa estar vinculada a uma Gerência (GAS, GVS ou GAP).');
    }

    await updateDoc(ref, payload);
    const saved = { id: existingId, ...payload };
    try {
      await syncLogisticaToFirestore(saved);
    } catch (err) {
      console.error('Falha ao sincronizar logística (programação já salva):', err);
    }
    if (notifiedEnvio) {
      try {
        await notifyProgramacaoEnviada(saved);
      } catch (err) {
        console.error('Falha ao notificar envio da programação:', err);
      }
    }
    return saved;
  }

  const payload = sanitizeProgramacao(data, uid, true);
  const { notifiedEnvio } = applyEnvioMetadata(payload, '', true);
  const nextStatus = normalizeStatus(payload.status);

  if (nextStatus !== 'Rascunho' && nextStatus !== 'Realizada' && (!payload.equipe || payload.equipe.length < 1)) {
    throw new Error('Informe pelo menos um participante na equipe.');
  }
  if ((nextStatus === STATUS_AGUARDANDO_GERENCIA || nextStatus === STATUS_REENVIADA) && !payload.gerencia) {
    throw new Error('A coordenação precisa estar vinculada a uma Gerência (GAS, GVS ou GAP).');
  }

  const { criadoEm, ...createPayload } = payload;
  const ref = await addDoc(collection(database, 'programacoes'), {
    ...createPayload,
    criadoEm: serverTimestamp(),
  });
  const saved = { id: ref.id, ...payload };
  try {
    await syncLogisticaToFirestore(saved);
  } catch (err) {
    console.error('Falha ao sincronizar logística (programação já salva):', err);
  }
  if (notifiedEnvio) {
    try {
      await notifyProgramacaoEnviada(saved);
    } catch (err) {
      console.error('Falha ao notificar envio da programação:', err);
    }
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

/** Atualiza somente o status — não sobrescreve o restante do documento */
export async function patchProgramacaoStatus(id, status, extra = {}) {
  const database = requireDb();
  requireUser();
  const prog = getProgramacaoById(id) || programacoesCache.find((p) => p.id === id);
  if (!prog) return null;

  const nextStatus = normalizeStatus(status);
  if (nextStatus !== 'Rascunho' && nextStatus !== 'Realizada') {
    const equipe = prog.equipe || [];
    if (!equipe.length) {
      throw new Error('Informe pelo menos um participante na equipe antes de alterar o status.');
    }
  }

  const prevStatus = normalizeStatus(prog.status);
  const historico = appendHistorico(prog.historico, makeHistoricoEntry({
    tipo: extra.historicoTipo || 'status',
    statusAnterior: prevStatus,
    statusNovo: nextStatus,
    observacao: extra.observacao || extra.justificativaDevolucao || '',
    gerencia: prog.gerencia || resolveGerenciaFromData(prog),
  }));
  const { historicoTipo, observacao, ...restExtra } = extra;
  const patch = {
    status: nextStatus,
    atualizadoEm: new Date().toISOString(),
    historico,
    ...restExtra,
  };
  await updateDoc(doc(database, 'programacoes', id), patch);
  return { ...prog, ...patch };
}

export async function approveProgramacao(id) {
  return patchProgramacaoStatus(id, 'Autorizada', {
    autorizadoEm: new Date().toISOString(),
    historicoTipo: 'status',
  });
}

export async function rejectProgramacao(id) {
  return patchProgramacaoStatus(id, 'Reprovada', { historicoTipo: 'status' });
}

export async function updateProgramacaoStatus(id, status) {
  return patchProgramacaoStatus(id, status);
}

export async function approveProgramacaoByGerencia(id) {
  const uid = requireUser();
  const prog = getProgramacaoById(id) || programacoesCache.find((p) => p.id === id);
  if (!prog) throw new Error('Programação não encontrada.');
  if (!isPendenteGerencia(prog.status)) {
    throw new Error('Esta programação não está aguardando análise da Gerência.');
  }
  const gerencia = resolveGerenciaFromData(prog) || normalizeGerencia(prog.gerencia);
  const role = getUserRole();
  if (role !== 'admin') {
    if (role !== 'gerencia') {
      throw new Error('Apenas a Gerência responsável pode aprovar.');
    }
    const minha = getUserGerencia();
    if (!gerencia || minha !== gerencia) {
      throw new Error('Você só pode aprovar programações da sua Gerência.');
    }
  }
  const actor = currentActorMeta();
  const saved = await patchProgramacaoStatus(id, STATUS_APROVADA_GERENCIA, {
    gerencia,
    aprovadoPor: uid,
    aprovadoPorNome: actor.nome,
    aprovadoEm: new Date().toISOString(),
    historicoTipo: 'aprovacao',
  });
  try {
    await notifyProgramacaoAprovada({ ...saved, gerencia });
  } catch (err) {
    console.error('Falha ao notificar aprovação:', err);
  }
  return saved;
}

export async function devolverProgramacaoParaCorrecao(id, justificativa) {
  const obs = String(justificativa || '').trim();
  if (!obs) throw new Error('Informe a justificativa da devolução.');
  requireUser();
  const prog = getProgramacaoById(id) || programacoesCache.find((p) => p.id === id);
  if (!prog) throw new Error('Programação não encontrada.');
  if (!isPendenteGerencia(prog.status)) {
    throw new Error('Esta programação não está aguardando análise da Gerência.');
  }
  const role = getUserRole();
  const gerencia = resolveGerenciaFromData(prog) || normalizeGerencia(prog.gerencia);
  if (role !== 'admin') {
    if (role !== 'gerencia') {
      throw new Error('Apenas a Gerência responsável pode devolver.');
    }
    const minha = getUserGerencia();
    if (!gerencia || minha !== gerencia) {
      throw new Error('Você só pode devolver programações da sua Gerência.');
    }
  }
  const actor = currentActorMeta();
  const saved = await patchProgramacaoStatus(id, STATUS_DEVOLVIDA, {
    gerencia,
    justificativaDevolucao: obs.slice(0, 2000),
    devolvidoPor: actor.uid,
    devolvidoPorNome: actor.nome,
    devolvidoEm: new Date().toISOString(),
    historicoTipo: 'devolucao',
    observacao: obs,
  });
  try {
    await notifyProgramacaoDevolvida({ ...saved, gerencia });
  } catch (err) {
    console.error('Falha ao notificar devolução:', err);
  }
  return saved;
}

/** Atualiza só o status para Realizada após anexo (sem exigir equipe). */
export async function markProgramacaoRealizadaPorAnexo(id) {
  const database = requireDb();
  requireUser();
  const prog = programacoesCache.find((p) => p.id === id);
  if (!prog) throw new Error('Programação não encontrada.');
  const current = normalizeStatus(prog.status);
  if (current === 'Realizada') return { ...prog, status: 'Realizada' };
  if (!canAttachAnexo(current)) return prog;
  await updateDoc(doc(database, 'programacoes', id), {
    status: 'Realizada',
    atualizadoEm: new Date().toISOString(),
  });
  return { ...prog, status: 'Realizada' };
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
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);
  const payload = {
    nome: user.nome || '',
    email: user.email || '',
    atualizadoEm: new Date().toISOString(),
  };
  if (!existing.exists()) {
    payload.ativo = true;
    payload.criadoEm = new Date().toISOString();
  }
  if (isBootstrapAdminEmail(user.email)) {
    payload.role = 'admin';
    payload.ativo = true;
  }
  await setDoc(ref, payload, { merge: true });
  const data = existing.exists() ? { ...existing.data(), ...payload } : payload;
  const role = normalizeRole(data.role);
  return {
    ativo: data.ativo !== false,
    role,
    gerencia: normalizeGerencia(data.gerencia),
    coordenacaoId: data.coordenacaoId || '',
  };
}

/** Carrega papel do usuário e mantém sincronizado */
export function subscribeUserRole(uid, callback) {
  if (!db || !uid) {
    callback('usuario', { ativo: true, gerencia: '', coordenacaoId: '' });
    return () => {};
  }
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const role = normalizeRole(data.role);
    const ativo = data.ativo !== false;
    const gerencia = normalizeGerencia(data.gerencia);
    const coordenacaoId = data.coordenacaoId || '';
    setUserRole(role, { gerencia });
    callback(role, { ativo, gerencia, coordenacaoId });
  }, () => {
    setUserRole('usuario');
    callback('usuario', { ativo: true, gerencia: '', coordenacaoId: '' });
  });
}

export async function fetchUserRole(uid) {
  if (!db || !uid) return 'usuario';
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.exists() ? snap.data() : {};
  const role = normalizeRole(data.role);
  setUserRole(role, { gerencia: data.gerencia });
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

/** Apaga TODOS os registros da coleção logistica (inclui órfãos) */
async function batchDeleteAllLogistica() {
  const database = requireDb();
  const snap = await getDocs(collection(database, 'logistica'));
  if (!snap.docs.length) return 0;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(database);
    chunk.forEach((d) => batch.delete(d.ref));
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

/** Apaga TODAS as programações e TODA a logística (somente admin) */
export async function deleteAllProgramacoes() {
  requireUser();
  if (getUserRole() !== 'admin') {
    throw new Error('Apenas administradores podem apagar todas as programações.');
  }
  const database = requireDb();
  const snap = await getDocs(collection(database, 'programacoes'));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const programacoes = await batchDeleteProgramacoes(items);
  const logistica = await batchDeleteAllLogistica();
  localStorage.removeItem(SEED_IMPORT_KEY);
  return { programacoes, logistica };
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
        const seedStatus = item.status === 'Programada' || item.status === 'Autorizado'
          ? 'Autorizada'
          : (item.status || 'Autorizada');
        const payload = sanitizeProgramacao({ ...item, status: seedStatus }, uid, true);
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
