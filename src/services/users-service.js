import {
  collection, doc, getDoc, getDocs, onSnapshot, addDoc, updateDoc, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { resolveAccessRole } from '../config/access-roster.js';
import { normalizeGerencia, normalizeRole } from './roles.js';
import {
  CARGO_ADMIN_ID,
  CARGO_DIRETORIA_ID,
  CARGO_GERENCIA_ID,
  CARGO_MEMBRO_ID,
  getCargoById,
} from './cargos-service.js';

function cargoIdForRole(role) {
  const r = normalizeRole(role);
  if (r === 'admin') return CARGO_ADMIN_ID;
  if (r === 'diretoria') return CARGO_DIRETORIA_ID;
  if (r === 'gerencia') return CARGO_GERENCIA_ID;
  return CARGO_MEMBRO_ID;
}

let usersCache = [];
let acessosCache = [];
let usersSyncError = '';
const userListeners = new Set();
const acessoListeners = new Set();
let unsubUsers = null;
let unsubAcessos = null;

function notifyUsers() {
  userListeners.forEach((fn) => fn(usersCache));
}

function notifyAcessos() {
  acessoListeners.forEach((fn) => fn(acessosCache));
}

export function getUsers() {
  return [...usersCache];
}

export function getUsersSyncError() {
  return usersSyncError;
}

export function getUserById(uid) {
  if (!uid) return null;
  return usersCache.find((u) => u.id === uid) || null;
}

/** Nome de quem incluiu a ação (campo gravado ou cadastro, para o admin). */
export function getIncluidoPorLabel(programacao) {
  const nome = String(programacao?.criadoPorNome || '').trim();
  if (nome) return nome;
  const user = getUserById(programacao?.criadoPor);
  if (user?.nome) return String(user.nome).trim();
  if (user?.email) return String(user.email).trim();
  const email = String(programacao?.criadoPorEmail || '').trim();
  return email;
}

export function getAcessos() {
  return [...acessosCache];
}

export function subscribeUsers(callback) {
  userListeners.add(callback);
  callback(usersCache);
  return () => userListeners.delete(callback);
}

export function subscribeAcessos(callback) {
  acessoListeners.add(callback);
  callback(acessosCache);
  return () => acessoListeners.delete(callback);
}

export function initUsersAdminSync() {
  if (!isFirebaseConfigured || !db) return;
  if (unsubUsers && unsubAcessos) return;

  unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
    usersSyncError = '';
    usersCache = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      ativo: d.data().ativo !== false,
    })).sort((a, b) => String(a.nome || a.email || '').localeCompare(String(b.nome || b.email || ''), 'pt-BR'));
    notifyUsers();
  }, (err) => {
    console.error('Erro ao sincronizar usuários:', err);
    usersSyncError = err?.code === 'permission-denied'
      ? 'Sem permissão para listar as contas. Elas não foram apagadas — entre com um perfil Administrador ou Diretoria e atualize a página.'
      : (err?.message || 'Erro ao carregar as contas.');
    notifyUsers();
  });

  unsubAcessos = onSnapshot(
    query(collection(db, 'acessos'), orderBy('criadoEm', 'desc'), limit(100)),
    (snap) => {
      acessosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyAcessos();
    },
    (err) => console.error('Erro ao sincronizar acessos:', err),
  );
}

/** Lê o perfil e retorna se a conta está ativa */
export async function fetchUserAccountStatus(uid) {
  if (!db || !uid) return { ativo: true, role: 'usuario' };
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { ativo: true, role: 'usuario' };
  const data = snap.data();
  return {
    ativo: data.ativo !== false,
    role: data.perfil || data.role || 'usuario',
    perfil: data.perfil || data.role || 'usuario',
    nome: data.nome || '',
    email: data.email || '',
    gerencia: data.gerenciaId || data.gerencia || '',
    gerenciaId: data.gerenciaId || data.gerencia || '',
    coordenacaoId: data.coordenacaoId || '',
  };
}

/** Registra um acesso (1x por sessão do navegador) */
export async function logUserAccess(user) {
  if (!db || !user?.uid) return;
  const key = `sigp-access-logged:${user.uid}`;
  try {
    if (sessionStorage.getItem(key) === '1') return;
  } catch { /* ignore */ }

  await addDoc(collection(db, 'acessos'), {
    uid: user.uid,
    nome: user.nome || '',
    email: (user.email || '').toLowerCase(),
    userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 300) : '',
    criadoEm: new Date().toISOString(),
  });

  try {
    sessionStorage.setItem(key, '1');
  } catch { /* ignore */ }
}

export async function setUserAtivo(uid, ativo) {
  if (!db || !uid) throw new Error('Usuário inválido.');
  await updateDoc(doc(db, 'users', uid), {
    ativo: Boolean(ativo),
    atualizadoEm: new Date().toISOString(),
  });
}

export async function setUserAccess(uid, {
  role,
  gerencia = '',
  coordenacaoId = '',
  cargoId = '',
} = {}) {
  if (!db || !uid) throw new Error('Usuário inválido.');
  const cargo = cargoId ? getCargoById(cargoId) : null;
  const nextRole = cargo
    ? normalizeRole(cargo.papelBase)
    : (['admin', 'diretoria', 'gerencia', 'usuario'].includes(role) ? role : 'usuario');
  const nextCargoId = cargo?.id || cargoIdForRole(nextRole);
  const nextCargoNome = cargo?.nome || (getCargoById(nextCargoId)?.nome || 'Membro');
  const nextGerencia = nextRole === 'gerencia' ? String(gerencia || '').toUpperCase() : '';
  if (nextRole === 'gerencia' && !['GAS', 'GVS', 'GAP'].includes(nextGerencia)) {
    throw new Error('Selecione a Gerência (GAS, GVS ou GAP).');
  }
  await updateDoc(doc(db, 'users', uid), {
    role: nextRole,
    perfil: nextRole,
    cargoId: nextCargoId,
    cargoNome: nextCargoNome,
    gerencia: nextGerencia,
    gerenciaId: nextGerencia,
    coordenacaoId: nextRole === 'usuario' ? (coordenacaoId || '') : '',
    atualizadoEm: new Date().toISOString(),
  });
}

/** Mantém só a administradora bootstrap. Os demais papéis ficam como definidos na Administração. */
export async function applyAccessRoster(users = getUsers()) {
  if (!db || !Array.isArray(users) || !users.length) return 0;
  let changed = 0;
  for (const u of users) {
    if (!u?.id) continue;
    const desired = resolveAccessRole(u);
    if (desired.role !== 'admin') continue;
    if (normalizeRole(u.perfil || u.role) === 'admin' && u.cargoId === CARGO_ADMIN_ID) continue;
    await setUserAccess(u.id, { role: 'admin', gerencia: '', cargoId: CARGO_ADMIN_ID });
    changed += 1;
  }
  return changed;
}

/** E-mails que já acessaram antes (exceto o acesso mais recente do mesmo login) */
export function firstAccessEmails(acessos = getAcessos()) {
  const counts = new Map();
  acessos.forEach((a) => {
    const email = String(a.email || '').toLowerCase();
    if (!email) return;
    counts.set(email, (counts.get(email) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, n]) => n <= 1).map(([e]) => e));
}

export async function listAllUsersOnce() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), ativo: d.data().ativo !== false }));
}
