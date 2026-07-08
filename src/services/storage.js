import {
  USUARIOS,
  COORDENACOES,
  MUNICIPIOS,
  REGIONAIS,
  EQUIPES,
  PROGRAMACOES,
  LOGISTICA,
} from '../data/seed.js';

const STORAGE_KEY = 'sigp_vs_data';
const AUTH_KEY = 'sigp_vs_auth';

const DEFAULT_DATA = {
  usuarios: USUARIOS,
  coordenacoes: COORDENACOES,
  municipios: MUNICIPIOS,
  regionais: REGIONAIS,
  equipes: EQUIPES,
  programacoes: PROGRAMACOES,
  logistica: LOGISTICA,
};

export function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
  }
}

export function getData() {
  initStorage();
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getCollection(name) {
  return getData()[name] || [];
}

export function setCollection(name, items) {
  const data = getData();
  data[name] = items;
  saveData(data);
}

export function addItem(collection, item) {
  const items = getCollection(collection);
  items.push(item);
  setCollection(collection, items);
  return item;
}

export function updateItem(collection, id, updates) {
  const items = getCollection(collection);
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...updates };
    setCollection(collection, items);
    return items[idx];
  }
  return null;
}

export function deleteItem(collection, id) {
  const items = getCollection(collection).filter((i) => i.id !== id);
  setCollection(collection, items);
}

export function getItemById(collection, id) {
  return getCollection(collection).find((i) => i.id === id);
}

export function setAuth(user) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function getAuth() {
  const raw = sessionStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  sessionStorage.removeItem(AUTH_KEY);
}

export function login(cpf, senha) {
  const cpfClean = cpf.replace(/\D/g, '');
  const user = getCollection('usuarios').find(
    (u) => u.cpf.replace(/\D/g, '') === cpfClean && u.senha === senha
  );
  if (user) {
    const { senha: _, ...safeUser } = user;
    setAuth(safeUser);
    return safeUser;
  }
  return null;
}

export function canEdit(user) {
  return user && (user.perfil === 'Administrador' || user.perfil === 'Gerência');
}

export function canApprove(user) {
  return user && (user.perfil === 'Administrador' || user.perfil === 'Gerência');
}

export function isAdmin(user) {
  return user && user.perfil === 'Administrador';
}

export function approveProgramacao(id) {
  const prog = getItemById('programacoes', id);
  if (!prog) return null;
  const updated = updateItem('programacoes', id, {
    status: 'Publicada',
    aprovadoEm: new Date().toISOString(),
  });
  syncLogistica(updated);
  return updated;
}

export function syncLogistica(programacao) {
  const logistica = getCollection('logistica');
  const existing = logistica.find((l) => l.programacaoId === programacao.id);
  if (programacao.necessitaTransporte || programacao.necessitaAlimentacao) {
    const entry = {
      id: existing?.id || `l_${Date.now()}`,
      programacaoId: programacao.id,
      municipioId: programacao.municipioId,
      transporte: programacao.necessitaTransporte,
      alimentacao: programacao.necessitaAlimentacao,
      situacao: existing?.situacao || 'Solicitado',
    };
    if (existing) {
      updateItem('logistica', existing.id, entry);
    } else {
      addItem('logistica', entry);
    }
  }
}

export function resetData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
}
