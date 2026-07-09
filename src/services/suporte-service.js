import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where,
  orderBy, getDocs, writeBatch, setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { auth } from '../firebase/config.js';

let chatsCache = [];
let messagesCache = [];
let activeChatId = null;
const chatListeners = new Set();
const msgListeners = new Set();
let unsubChats = null;
let unsubMsgs = null;

function notifyChats() {
  chatListeners.forEach((fn) => fn([...chatsCache]));
}

function notifyMsgs() {
  msgListeners.forEach((fn) => fn([...messagesCache], activeChatId));
}

export function subscribeSuporteChats(callback) {
  chatListeners.add(callback);
  callback([...chatsCache]);
  return () => chatListeners.delete(callback);
}

export function subscribeSuporteMessages(callback) {
  msgListeners.add(callback);
  callback([...messagesCache], activeChatId);
  return () => msgListeners.delete(callback);
}

export async function fetchSuporteAdmins() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'suporte_admins'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function initSuporteSync(isAdmin) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return;
  if (unsubChats) unsubChats();

  if (isAdmin) {
    unsubChats = onSnapshot(
      query(collection(db, 'suporte_chats'), where('status', '==', 'aberto'), orderBy('ultimaMensagemEm', 'desc')),
      (snap) => {
        chatsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notifyChats();
      },
      () => { chatsCache = []; notifyChats(); },
    );
  } else {
    const uid = auth.currentUser.uid;
    unsubChats = onSnapshot(
      query(collection(db, 'suporte_chats'), where('userId', '==', uid), where('status', '==', 'aberto')),
      (snap) => {
        chatsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notifyChats();
      },
      () => { chatsCache = []; notifyChats(); },
    );
  }
}

export function watchSuporteMessages(chatId) {
  if (!db || !chatId) return;
  activeChatId = chatId;
  if (unsubMsgs) unsubMsgs();
  unsubMsgs = onSnapshot(
    query(collection(db, 'suporte_chats', chatId, 'mensagens'), orderBy('criadoEm', 'asc')),
    (snap) => {
      messagesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyMsgs();
    },
    () => { messagesCache = []; notifyMsgs(); },
  );
}

export async function getOrCreateUserChat(user) {
  if (!db) throw new Error('Firebase não configurado.');
  const existing = chatsCache.find((c) => c.status === 'aberto');
  if (existing) return existing.id;

  const ref = await addDoc(collection(db, 'suporte_chats'), {
    userId: user.uid,
    userNome: user.nome || user.email || 'Usuário',
    userEmail: user.email || '',
    status: 'aberto',
    criadoEm: new Date().toISOString(),
    ultimaMensagemEm: new Date().toISOString(),
  });
  return ref.id;
}

export async function sendSuporteMessage(chatId, texto, { nome, isAdmin = false } = {}) {
  if (!db || !chatId || !texto.trim()) return;
  const uid = auth?.currentUser?.uid;
  await addDoc(collection(db, 'suporte_chats', chatId, 'mensagens'), {
    texto: texto.trim(),
    autorUid: uid,
    autorNome: nome || 'Usuário',
    isAdmin,
    criadoEm: new Date().toISOString(),
  });
  await updateDoc(doc(db, 'suporte_chats', chatId), {
    ultimaMensagemEm: new Date().toISOString(),
  });
}

export async function finalizarSuporteChat(chatId) {
  if (!db || !chatId) return;
  const msgs = await getDocs(collection(db, 'suporte_chats', chatId, 'mensagens'));
  const batch = writeBatch(db);
  msgs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'suporte_chats', chatId));
  await batch.commit();
  if (activeChatId === chatId) {
    activeChatId = null;
    messagesCache = [];
    notifyMsgs();
  }
}

export async function registerSuporteAdmin(user) {
  if (!db || !user?.uid) return;
  await setDoc(doc(db, 'suporte_admins', user.uid), {
    nome: user.nome || user.email || 'Administrador',
    email: user.email || '',
  }, { merge: true });
}

export function getOpenChats() {
  return [...chatsCache];
}
