import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { COORDENACOES as SEED_COORDS, REGIONAIS as SEED_REGS, MUNICIPIOS as SEED_MUNS } from '../data/reference-data.js';

const SEED_KEY = 'sigp-catalog-seeded-v1';

let coordsCache = [...SEED_COORDS];
let munsCache = [...SEED_MUNS];
let regsCache = [...SEED_REGS];
const listeners = new Set();
let unsubs = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeCatalog(callback) {
  listeners.add(callback);
  callback();
  return () => listeners.delete(callback);
}

export function getCoordenacoes() {
  return [...coordsCache];
}

export function getMunicipios() {
  return [...munsCache];
}

export function getRegionais() {
  return [...regsCache];
}

export function initCatalogSync() {
  if (!isFirebaseConfigured || !db) return;
  unsubs.forEach((u) => u());
  unsubs = [
    onSnapshot(collection(db, 'coordenacoes'), (snap) => {
      if (snap.empty) return;
      coordsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notify();
    }),
    onSnapshot(collection(db, 'municipios'), (snap) => {
      if (snap.empty) return;
      munsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notify();
    }),
    onSnapshot(collection(db, 'regionais'), (snap) => {
      if (snap.empty) return;
      regsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notify();
    }),
  ];
}

export async function seedCatalogIfEmpty() {
  if (!db || localStorage.getItem(SEED_KEY) === 'done') return;
  const [cSnap, mSnap, rSnap] = await Promise.all([
    getDocs(collection(db, 'coordenacoes')),
    getDocs(collection(db, 'municipios')),
    getDocs(collection(db, 'regionais')),
  ]);
  if (!cSnap.empty && !mSnap.empty && !rSnap.empty) {
    localStorage.setItem(SEED_KEY, 'done');
    return;
  }
  const batch = writeBatch(db);
  if (cSnap.empty) SEED_COORDS.forEach((c) => batch.set(doc(db, 'coordenacoes', c.id), c));
  if (mSnap.empty) SEED_MUNS.forEach((m) => batch.set(doc(db, 'municipios', m.id), m));
  if (rSnap.empty) SEED_REGS.forEach((r) => batch.set(doc(db, 'regionais', r.id), r));
  await batch.commit();
  localStorage.setItem(SEED_KEY, 'done');
}

export async function saveCoordenacao(data, id = null) {
  if (!db) throw new Error('Firebase não configurado.');
  const docId = id || data.id || `coord-${Date.now()}`;
  const payload = {
    nome: data.nome || '',
    sigla: data.sigla || '',
    gerencia: data.gerencia || 'GAS',
  };
  await setDoc(doc(db, 'coordenacoes', docId), payload, { merge: true });
  return { id: docId, ...payload };
}

export async function removeCoordenacao(id) {
  if (!db) throw new Error('Firebase não configurado.');
  await deleteDoc(doc(db, 'coordenacoes', id));
}

export async function saveMunicipio(data, id = null) {
  if (!db) throw new Error('Firebase não configurado.');
  const docId = id || data.id || `m-${Date.now()}`;
  const payload = { nome: data.nome || '', regionalId: data.regionalId || '' };
  await setDoc(doc(db, 'municipios', docId), payload, { merge: true });
  return { id: docId, ...payload };
}

export async function removeMunicipio(id) {
  if (!db) throw new Error('Firebase não configurado.');
  await deleteDoc(doc(db, 'municipios', id));
}

export async function saveRegional(data, id = null) {
  if (!db) throw new Error('Firebase não configurado.');
  const docId = id || data.id || `reg-${Date.now()}`;
  const payload = { nome: data.nome || '' };
  await setDoc(doc(db, 'regionais', docId), payload, { merge: true });
  return { id: docId, ...payload };
}

export async function removeRegional(id) {
  if (!db) throw new Error('Firebase não configurado.');
  await deleteDoc(doc(db, 'regionais', id));
}
