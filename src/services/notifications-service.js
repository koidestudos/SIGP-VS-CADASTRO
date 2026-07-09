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
    lido: false,
    criadoEm: new Date().toISOString(),
  });
}

/** @deprecated use notifyProgramacaoEnviada */
export async function notifyProgramacaoPendente(programacao) {
  return notifyProgramacaoEnviada(programacao);
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
