import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { PROGRAMACOES as SEED_PROGRAMACOES } from '../data/seed.js';

const LS_KEY = 'sigp_vs_programacoes';
let cache = [];
const listeners = new Set();
let unsubscribeFirestore = null;

function notify() {
  listeners.forEach((fn) => fn([...cache]));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    cache = raw ? JSON.parse(raw) : [...SEED_PROGRAMACOES];
  } catch {
    cache = [...SEED_PROGRAMACOES];
  }
  notify();
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(cache));
  notify();
}

export function subscribeProgramacoes(callback) {
  listeners.add(callback);
  callback([...cache]);
  return () => listeners.delete(callback);
}

export function getProgramacoes() {
  return [...cache];
}

export function getProgramacaoById(id) {
  return cache.find((p) => p.id === id) || null;
}

export function initProgramacoesSync() {
  if (!isFirebaseConfigured || !db) {
    loadLocal();
    return;
  }

  if (unsubscribeFirestore) unsubscribeFirestore();

  const q = collection(db, 'programacoes');
  unsubscribeFirestore = onSnapshot(q, (snap) => {
    cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  }, () => {
    loadLocal();
  });
}

export async function saveProgramacao(data, existingId = null) {
  const payload = {
    ...data,
    atualizadoEm: new Date().toISOString(),
    criadoEm: data.criadoEm || new Date().toISOString(),
  };

  if (isFirebaseConfigured && db) {
    if (existingId) {
      await updateDoc(doc(db, 'programacoes', existingId), payload);
      return { id: existingId, ...payload };
    }
    const ref = await addDoc(collection(db, 'programacoes'), {
      ...payload,
      criadoEm: serverTimestamp(),
    });
    return { id: ref.id, ...payload };
  }

  if (existingId) {
    const idx = cache.findIndex((p) => p.id === existingId);
    if (idx >= 0) cache[idx] = { id: existingId, ...payload };
  } else {
    const id = `p_${Date.now()}`;
    cache.push({ id, ...payload });
  }
  saveLocal();
  return existingId ? cache.find((p) => p.id === existingId) : cache[cache.length - 1];
}

export async function removeProgramacao(id) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'programacoes', id));
    return;
  }
  cache = cache.filter((p) => p.id !== id);
  saveLocal();
}

export async function approveProgramacao(id) {
  const prog = getProgramacaoById(id);
  if (!prog) return null;
  return saveProgramacao({ ...prog, status: 'Publicada', aprovadoEm: new Date().toISOString() }, id);
}

export function syncLogisticaFromProgramacao(programacao) {
  if (!programacao.necessitaTransporte && !programacao.necessitaAlimentacao) return;
  const logistica = JSON.parse(localStorage.getItem('sigp_vs_logistica') || '[]');
  const existing = logistica.find((l) => l.programacaoId === programacao.id);
  const entry = {
    id: existing?.id || `l_${Date.now()}`,
    programacaoId: programacao.id,
    municipioId: programacao.municipioId,
    transporte: programacao.necessitaTransporte,
    alimentacao: programacao.necessitaAlimentacao,
    situacao: existing?.situacao || 'Solicitado',
  };
  if (existing) Object.assign(existing, entry);
  else logistica.push(entry);
  localStorage.setItem('sigp_vs_logistica', JSON.stringify(logistica));
}

export function getLogistica() {
  return JSON.parse(localStorage.getItem('sigp_vs_logistica') || '[]');
}

export function updateLogisticaSituacao(id, situacao) {
  const logistica = getLogistica();
  const item = logistica.find((l) => l.id === id);
  if (item) item.situacao = situacao;
  localStorage.setItem('sigp_vs_logistica', JSON.stringify(logistica));
}
