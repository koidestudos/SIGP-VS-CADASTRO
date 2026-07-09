import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  orderBy, getDocs, writeBatch, setDoc, query, where,
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

export function getUnreadSuporteCount(isAdmin) {
  if (isAdmin) return chatsCache.filter((c) => c.naoLidoAdmin).length;
  return chatsCache.some((c) => c.naoLidoUser) ? 1 : 0;
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
    unsubChats = onSnapshot(collection(db, 'suporte_chats'), (snap) => {
      chatsCache = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.status === 'aberto')
        .sort((a, b) => (b.ultimaMensagemEm || '').localeCompare(a.ultimaMensagemEm || ''));
      notifyChats();
    }, () => { chatsCache = []; notifyChats(); });
  } else {
    const uid = auth.currentUser.uid;
    unsubChats = onSnapshot(
      query(collection(db, 'suporte_chats'), where('userId', '==', uid)),
      (snap) => {
        chatsCache = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => c.status === 'aberto')
          .sort((a, b) => (b.ultimaMensagemEm || '').localeCompare(a.ultimaMensagemEm || ''));
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
    naoLidoAdmin: false,
    naoLidoUser: false,
    ultimaMensagem: '',
    criadoEm: new Date().toISOString(),
    ultimaMensagemEm: new Date().toISOString(),
  });
  return ref.id;
}

export async function sendSuporteMessage(chatId, texto, { nome, isAdmin = false, tipo = 'texto' } = {}) {
  if (!db || !chatId || !texto?.trim()) return;
  const uid = auth?.currentUser?.uid;
  const msg = texto.trim();
  await addDoc(collection(db, 'suporte_chats', chatId, 'mensagens'), {
    texto: msg,
    autorUid: uid,
    autorNome: nome || 'Usuário',
    isAdmin,
    tipo,
    criadoEm: new Date().toISOString(),
  });
  await updateDoc(doc(db, 'suporte_chats', chatId), {
    ultimaMensagem: msg,
    ultimaMensagemEm: new Date().toISOString(),
    naoLidoAdmin: !isAdmin,
    naoLidoUser: isAdmin,
  });
}

export async function markSuporteChatRead(chatId, isAdmin) {
  if (!db || !chatId) return;
  await updateDoc(doc(db, 'suporte_chats', chatId), {
    [isAdmin ? 'naoLidoAdmin' : 'naoLidoUser']: false,
  });
}

export async function iniciarConversaAdmin(chatId, adminNome) {
  const chat = chatsCache.find((c) => c.id === chatId);
  await markSuporteChatRead(chatId, true);
  watchSuporteMessages(chatId);
  if (!chat?.adminIniciou) {
    await sendSuporteMessage(chatId, 'Conversa iniciada', {
      nome: 'Sistema',
      isAdmin: true,
      tipo: 'sistema',
    });
    await updateDoc(doc(db, 'suporte_chats', chatId), {
      adminIniciou: true,
      adminNome: adminNome || 'Administrador',
    });
  }
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

export async function promoteUserToAdmin(email) {
  if (!db) throw new Error('Firebase não configurado.');
  const normalized = email.trim().toLowerCase();
  const snap = await getDocs(query(collection(db, 'users'), where('email', '==', normalized)));
  if (snap.empty) throw new Error('Usuário não encontrado. A pessoa precisa criar a conta primeiro.');
  const userDoc = snap.docs[0];
  await updateDoc(userDoc.ref, { role: 'admin', atualizadoEm: new Date().toISOString() });
  const data = userDoc.data();
  await setDoc(doc(db, 'suporte_admins', userDoc.id), {
    nome: data.nome || normalized,
    email: normalized,
  }, { merge: true });
  return { uid: userDoc.id, email: normalized, nome: data.nome };
}
