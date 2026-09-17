/**
 * Cargos da plataforma: sistema (Membro, Gerência, Diretoria, Administrador)
 * e cargos personalizados criados pelo admin, com permissões em accordion.
 * A lógica de autorização continua baseada em role/papelBase (roles.js).
 */
import {
  collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { normalizeRole, ROLE_ADMIN, ROLE_DIRETORIA, ROLE_GERENCIA, ROLE_USUARIO } from './roles.js';

// getUsers importado sob demanda para evitar ciclo com users-service

export const CARGO_MEMBRO_ID = 'cargo-membro';
export const CARGO_GERENCIA_ID = 'cargo-gerencia';
export const CARGO_DIRETORIA_ID = 'cargo-diretoria';
export const CARGO_ADMIN_ID = 'cargo-admin';

export const PERMISSAO_DEFS = [
  { key: 'verDashboard', label: 'Ver Dashboard' },
  { key: 'verTodasProgramacoes', label: 'Ver todas as programações' },
  { key: 'criarProgramacao', label: 'Criar programações' },
  { key: 'editarPropria', label: 'Editar programação própria' },
  { key: 'editarQualquer', label: 'Editar qualquer programação' },
  { key: 'excluirProgramacao', label: 'Excluir programações' },
  { key: 'alterarStatusGerencia', label: 'Alterar status gerencial' },
  { key: 'analisarGerencia', label: 'Analisar / aprovar na Gerência' },
  { key: 'acessarTodasGerencias', label: 'Acessar todas as gerências' },
  { key: 'gerenciarUsuarios', label: 'Gerenciar usuários e cargos' },
  { key: 'acessarAdmin', label: 'Acessar Administração' },
  { key: 'acessarBI', label: 'Acessar BI Gerencial' },
];

export function emptyPermissoes() {
  return Object.fromEntries(PERMISSAO_DEFS.map((p) => [p.key, false]));
}

export function permissoesForPapel(papel) {
  const role = normalizeRole(papel);
  const p = emptyPermissoes();
  p.verDashboard = true;
  p.verTodasProgramacoes = true;
  if (role === ROLE_ADMIN) {
    PERMISSAO_DEFS.forEach((d) => { p[d.key] = true; });
    return p;
  }
  if (role === ROLE_DIRETORIA) {
    p.acessarTodasGerencias = true;
    p.acessarAdmin = true;
    p.acessarBI = true;
    return p;
  }
  if (role === ROLE_GERENCIA) {
    p.criarProgramacao = true;
    p.editarPropria = true;
    p.alterarStatusGerencia = true;
    p.analisarGerencia = true;
    return p;
  }
  // Membro / coordenação
  p.criarProgramacao = true;
  p.editarPropria = true;
  return p;
}

export function derivePapelBase(permissoes = {}) {
  if (permissoes.gerenciarUsuarios || permissoes.editarQualquer || permissoes.excluirProgramacao) {
    return ROLE_ADMIN;
  }
  if (permissoes.analisarGerencia || permissoes.alterarStatusGerencia) {
    return ROLE_GERENCIA;
  }
  if (permissoes.acessarAdmin || permissoes.acessarBI || permissoes.acessarTodasGerencias) {
    return ROLE_DIRETORIA;
  }
  return ROLE_USUARIO;
}

export function summarizePermissoes(permissoes = {}) {
  const on = PERMISSAO_DEFS.filter((d) => permissoes[d.key]).map((d) => d.label);
  if (!on.length) return 'Nenhuma permissão';
  if (on.length <= 3) return on.join(' · ');
  return `${on.slice(0, 3).join(' · ')} · +${on.length - 3}`;
}

export const SYSTEM_CARGOS = [
  {
    id: CARGO_MEMBRO_ID,
    nome: 'Membro',
    sistema: true,
    papelBase: ROLE_USUARIO,
    permissoes: permissoesForPapel(ROLE_USUARIO),
  },
  {
    id: CARGO_GERENCIA_ID,
    nome: 'Gerência',
    sistema: true,
    papelBase: ROLE_GERENCIA,
    permissoes: permissoesForPapel(ROLE_GERENCIA),
  },
  {
    id: CARGO_DIRETORIA_ID,
    nome: 'Diretoria',
    sistema: true,
    papelBase: ROLE_DIRETORIA,
    permissoes: permissoesForPapel(ROLE_DIRETORIA),
  },
  {
    id: CARGO_ADMIN_ID,
    nome: 'Administrador',
    sistema: true,
    papelBase: ROLE_ADMIN,
    permissoes: permissoesForPapel(ROLE_ADMIN),
  },
];

function systemCargoByPapel(papel) {
  const role = normalizeRole(papel);
  if (role === ROLE_ADMIN) return SYSTEM_CARGOS.find((c) => c.id === CARGO_ADMIN_ID);
  if (role === ROLE_DIRETORIA) return SYSTEM_CARGOS.find((c) => c.id === CARGO_DIRETORIA_ID);
  if (role === ROLE_GERENCIA) return SYSTEM_CARGOS.find((c) => c.id === CARGO_GERENCIA_ID);
  return SYSTEM_CARGOS.find((c) => c.id === CARGO_MEMBRO_ID);
}

let cargosCache = [...SYSTEM_CARGOS];
let unsubCargos = null;
const listeners = new Set();
let seedPromise = null;

function notify() {
  listeners.forEach((fn) => {
    try { fn(getCargos()); } catch { /* ignore */ }
  });
}

function normalizeCargoDoc(id, data = {}) {
  const sistema = Boolean(data.sistema) || SYSTEM_CARGOS.some((c) => c.id === id);
  const base = SYSTEM_CARGOS.find((c) => c.id === id);
  const nome = String(data.nome || base?.nome || 'Cargo').trim().slice(0, 80) || 'Cargo';
  const permissoes = { ...emptyPermissoes(), ...(base?.permissoes || {}), ...(data.permissoes || {}) };
  const papelBase = normalizeRole(data.papelBase || derivePapelBase(permissoes) || base?.papelBase);
  return {
    id,
    nome,
    sistema,
    papelBase,
    permissoes,
    criadoEm: data.criadoEm || '',
    atualizadoEm: data.atualizadoEm || '',
  };
}

export function getCargos() {
  const byId = new Map();
  SYSTEM_CARGOS.forEach((c) => byId.set(c.id, { ...c, permissoes: { ...c.permissoes } }));
  cargosCache.forEach((c) => {
    if (!c?.id) return;
    byId.set(c.id, normalizeCargoDoc(c.id, c));
  });
  return [...byId.values()].sort((a, b) => {
    if (a.sistema !== b.sistema) return a.sistema ? -1 : 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

export function getCargoById(id) {
  if (!id) return null;
  return getCargos().find((c) => c.id === id) || null;
}

export function resolveCargoForUser(user = {}) {
  const byId = getCargoById(user.cargoId);
  if (byId) return byId;
  const byNome = getCargos().find((c) => c.nome === user.cargoNome);
  if (byNome) return byNome;
  return systemCargoByPapel(user.perfil || user.role);
}

export function cargoLabelForUser(user = {}) {
  const cargo = resolveCargoForUser(user);
  if (!cargo) return 'Membro';
  if (cargo.papelBase === ROLE_GERENCIA) {
    const g = String(user.gerenciaId || user.gerencia || '').toUpperCase();
    return g ? `${cargo.nome} ${g}` : cargo.nome;
  }
  return cargo.nome;
}

export function countUsersWithCargo(cargoId, users) {
  if (!cargoId) return 0;
  const list = users || [];
  return list.filter((u) => {
    if (u.cargoId === cargoId) return true;
    if (!u.cargoId) {
      const fallback = systemCargoByPapel(u.perfil || u.role);
      return fallback?.id === cargoId;
    }
    return false;
  }).length;
}

export function subscribeCargos(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function ensureSystemCargos() {
  if (!db || !isFirebaseConfigured) return;
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const now = new Date().toISOString();
    await Promise.all(SYSTEM_CARGOS.map(async (c) => {
      const ref = doc(db, 'cargos', c.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await setDoc(ref, {
          nome: c.nome,
          sistema: true,
          papelBase: c.papelBase,
          atualizadoEm: now,
        }, { merge: true });
        return;
      }
      await setDoc(ref, {
        nome: c.nome,
        sistema: true,
        papelBase: c.papelBase,
        permissoes: c.permissoes,
        atualizadoEm: now,
        criadoEm: now,
      });
    }));
  })().finally(() => { seedPromise = null; });
  return seedPromise;
}

export function initCargosSync() {
  if (!isFirebaseConfigured || !db) {
    cargosCache = [...SYSTEM_CARGOS];
    notify();
    return () => {};
  }
  if (unsubCargos) return unsubCargos;
  ensureSystemCargos().catch((err) => console.error('Falha ao semear cargos:', err));
  unsubCargos = onSnapshot(collection(db, 'cargos'), (snap) => {
    const fromDb = snap.docs.map((d) => normalizeCargoDoc(d.id, d.data()));
    cargosCache = fromDb.length ? fromDb : [...SYSTEM_CARGOS];
    notify();
  }, (err) => {
    console.error('Falha ao sincronizar cargos:', err);
    cargosCache = [...SYSTEM_CARGOS];
    notify();
  });
  return unsubCargos;
}

function slugifyCargoId(nome) {
  const base = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'cargo';
  return `cargo-${base}-${Date.now().toString(36)}`;
}

export async function saveCargo({ id = null, nome, permissoes }) {
  if (!db) throw new Error('Firebase não configurado.');
  const cleanNome = String(nome || '').trim().slice(0, 80);
  if (!cleanNome) throw new Error('Informe o nome do cargo.');
  const perms = { ...emptyPermissoes(), ...(permissoes || {}) };
  Object.keys(perms).forEach((k) => { perms[k] = Boolean(perms[k]); });
  const existing = id ? getCargoById(id) : null;
  const papelBase = existing?.sistema
    ? existing.papelBase
    : derivePapelBase(perms);
  const finalPerms = { ...perms };
  if (papelBase === ROLE_ADMIN) {
    PERMISSAO_DEFS.forEach((d) => { finalPerms[d.key] = true; });
  }
  const now = new Date().toISOString();
  const cargoId = id || slugifyCargoId(cleanNome);
  const payload = {
    nome: existing?.sistema ? existing.nome : cleanNome,
    sistema: Boolean(existing?.sistema),
    papelBase,
    permissoes: finalPerms,
    atualizadoEm: now,
  };
  if (!id) payload.criadoEm = now;
  await setDoc(doc(db, 'cargos', cargoId), payload, { merge: true });
  return { id: cargoId, ...payload };
}

export async function deleteCargo(cargoId, usersUsing = []) {
  if (!db) throw new Error('Firebase não configurado.');
  const cargo = getCargoById(cargoId);
  if (!cargo) throw new Error('Cargo não encontrado.');
  if (cargo.sistema) throw new Error('Cargos do sistema não podem ser excluídos.');

  const users = Array.isArray(usersUsing) ? usersUsing.filter((u) => u.cargoId === cargoId) : [];
  const membro = getCargoById(CARGO_MEMBRO_ID) || SYSTEM_CARGOS[0];
  if (users.length) {
    const batch = writeBatch(db);
    users.forEach((u) => {
      batch.update(doc(db, 'users', u.id), {
        cargoId: membro.id,
        cargoNome: membro.nome,
        role: ROLE_USUARIO,
        perfil: ROLE_USUARIO,
        gerencia: '',
        gerenciaId: '',
        atualizadoEm: new Date().toISOString(),
      });
    });
    await batch.commit();
  }
  await deleteDoc(doc(db, 'cargos', cargoId));
  return { reassigned: users.length };
}

export async function listCargosOnce() {
  if (!db) return getCargos();
  await ensureSystemCargos();
  const snap = await getDocs(collection(db, 'cargos'));
  return snap.docs.map((d) => normalizeCargoDoc(d.id, d.data()));
}

export function cargoOptionsForSelect() {
  return getCargos().map((c) => ({
    id: c.id,
    nome: c.nome,
    papelBase: c.papelBase,
    sistema: c.sistema,
  }));
}
