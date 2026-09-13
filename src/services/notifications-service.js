import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';

let notifCache = [];
const listeners = new Set();
let unsub = null;

function notify() {
  listeners.forEach((fn) => fn([...notifCache]));
}

export function subscribeNotifications(callback) {
  listeners.add(callback);
  callback([...notifCache]);
  return () => listeners.delete(callback);
}

export function getNotifications() {
  return [...notifCache];
}

export function getUnreadCount() {
  return notifCache.filter((n) => !n.lido).length;
}

/** @deprecated use notifyProgramacaoEnviada */
export async function notifyProgramacaoPendente(programacao) {
  return notifyProgramacaoEnviada(programacao);
}

export function initNotificationsSync() {
  if (!isFirebaseConfigured || !db) return;
  if (unsub) unsub();

  const q = query(
    collection(db, 'notificacoes'),
    orderBy('criadoEm', 'desc'),
    limit(50),
  );

  unsub = onSnapshot(q, (snap) => {
    notifCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  }, () => {
    notifCache = [];
    notify();
  });
}

export async function notifyProgramacaoEnviada(programacao) {
  if (!db || !programacao?.id) return;
  await addDoc(collection(db, 'notificacoes'), {
    tipo: 'programacao_enviada',
    programacaoId: programacao.id,
    titulo: programacao.titulo || 'Nova programação',
    coordenacaoId: programacao.coordenacaoId || '',
    criadoPor: programacao.criadoPor || '',
    criadoPorNome: programacao.criadoPorNome || '',
    criadoPorEmail: programacao.criadoPorEmail || '',
    gerencia: programacao.gerencia || '',
    lido: false,
    criadoEm: new Date().toISOString(),
  });
}

export async function notifyProgramacaoAnexo(programacao, anexo) {
  if (!db || !programacao?.id || !anexo?.id) return;
  await addDoc(collection(db, 'notificacoes'), {
    tipo: 'programacao_anexo',
    programacaoId: programacao.id,
    anexoId: anexo.id,
    titulo: programacao.titulo || 'Programação',
    nomeArquivo: anexo.nomeArquivo || 'Documento',
    coordenacaoId: programacao.coordenacaoId || '',
    enviadoPor: anexo.enviadoPor || '',
    enviadoPorNome: anexo.enviadoPorNome || '',
    gerencia: programacao.gerencia || '',
    lido: false,
    criadoEm: new Date().toISOString(),
  });
}

export async function notifyProgramacaoDevolvida(programacao) {
  if (!db || !programacao?.id) return;
  await addDoc(collection(db, 'notificacoes'), {
    tipo: 'programacao_devolvida',
    programacaoId: programacao.id,
    titulo: programacao.titulo || 'Programação devolvida',
    coordenacaoId: programacao.coordenacaoId || '',
    criadoPor: programacao.criadoPor || '',
    criadoPorNome: programacao.criadoPorNome || '',
    gerencia: programacao.gerencia || '',
    observacao: String(programacao.justificativaDevolucao || '').slice(0, 500),
    lido: false,
    criadoEm: new Date().toISOString(),
  });
}

export async function notifyProgramacaoAprovada(programacao) {
  if (!db || !programacao?.id) return;
  await addDoc(collection(db, 'notificacoes'), {
    tipo: 'programacao_aprovada',
    programacaoId: programacao.id,
    titulo: programacao.titulo || 'Programação aprovada',
    coordenacaoId: programacao.coordenacaoId || '',
    criadoPor: programacao.criadoPor || '',
    criadoPorNome: programacao.criadoPorNome || '',
    gerencia: programacao.gerencia || '',
    aprovadoPorNome: programacao.aprovadoPorNome || '',
    lido: false,
    criadoEm: new Date().toISOString(),
  });
}

export function getNotificationsForUser(user) {
  const all = getNotifications();
  const role = user?.role;
  if (role === 'admin' || role === 'diretoria') return all;
  if (role === 'gerencia') {
    const g = String(user.gerencia || '').toUpperCase();
    return all.filter((n) => !n.gerencia || String(n.gerencia).toUpperCase() === g);
  }
  if (!user?.uid) return [];
  return all.filter((n) => n.criadoPor === user.uid || n.tipo === 'programacao_devolvida' && n.criadoPor === user.uid);
}

export function getUnreadCountForUser(user) {
  return getNotificationsForUser(user).filter((n) => !n.lido).length;
}

export async function markNotificationRead(id) {
  if (!db || !id) return;
  await updateDoc(doc(db, 'notificacoes', id), { lido: true });
}

export async function markAllNotificationsRead() {
  if (!db) return;
  const unread = notifCache.filter((n) => !n.lido);
  await Promise.all(unread.map((n) => updateDoc(doc(db, 'notificacoes', n.id), { lido: true })));
}

export async function deleteNotification(id) {
  if (!db || !id) return;
  await deleteDoc(doc(db, 'notificacoes', id));
}

export async function deleteAllNotifications() {
  if (!db) return;
  await Promise.all(notifCache.map((n) => deleteDoc(doc(db, 'notificacoes', n.id))));
}
