import {
  collection, doc, getDoc, getDocs, onSnapshot, addDoc, updateDoc, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';

let usersCache = [];
let acessosCache = [];
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
  if (unsubUsers) unsubUsers();
  if (unsubAcessos) unsubAcessos();

  unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
    usersCache = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      ativo: d.data().ativo !== false,
    })).sort((a, b) => String(a.nome || a.email || '').localeCompare(String(b.nome || b.email || ''), 'pt-BR'));
    notifyUsers();
  }, (err) => console.error('Erro ao sincronizar usuários:', err));

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
    role: data.role === 'admin' ? 'admin' : 'usuario',
    nome: data.nome || '',
    email: data.email || '',
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
