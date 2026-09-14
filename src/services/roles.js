import { normalizeStatus, STATUS_DEVOLVIDA } from '../utils/status.js';

/** Papéis: usuario (coordenação), gerencia, diretoria, admin */

export const ROLE_USUARIO = 'usuario';
export const ROLE_GERENCIA = 'gerencia';
export const ROLE_DIRETORIA = 'diretoria';
export const ROLE_ADMIN = 'admin';

export const GERENCIAS = ['GAS', 'GVS', 'GAP'];

let currentRole = ROLE_USUARIO;
let currentGerencia = '';

export function normalizeRole(role) {
  if (role === ROLE_ADMIN) return ROLE_ADMIN;
  if (role === ROLE_DIRETORIA) return ROLE_DIRETORIA;
  if (role === ROLE_GERENCIA) return ROLE_GERENCIA;
  return ROLE_USUARIO;
}

export function normalizeGerencia(value) {
  const g = String(value || '').trim().toUpperCase();
  return GERENCIAS.includes(g) ? g : '';
}

export function setUserRole(role, extra = {}) {
  currentRole = normalizeRole(role);
  currentGerencia = normalizeGerencia(extra.gerencia);
}

export function getUserRole() {
  return currentRole;
}

export function getUserGerencia() {
  return currentGerencia;
}

function roleOf(user) {
  if (user && typeof user === 'object') return normalizeRole(user.role);
  return currentRole;
}

export function isAdmin(user) {
  return roleOf(user) === ROLE_ADMIN;
}

export function isDiretoria(user) {
  const role = roleOf(user);
  return role === ROLE_ADMIN || role === ROLE_DIRETORIA;
}

export function isGerencia(user) {
  return roleOf(user) === ROLE_GERENCIA;
}

export function isCoordenacao(user) {
  return roleOf(user) === ROLE_USUARIO;
}

export function roleLabel(user) {
  const role = roleOf(user);
  if (role === ROLE_ADMIN) return 'Administrador';
  if (role === ROLE_DIRETORIA) return 'Diretoria';
  if (role === ROLE_GERENCIA) {
    const g = user && typeof user === 'object'
      ? normalizeGerencia(user.gerencia)
      : currentGerencia;
    return g ? `Gerência ${g}` : 'Gerência';
  }
  return 'Coordenação';
}

export function canEdit(user) {
  return Boolean(user);
}

export function programacaoGerencia(programacao) {
  return normalizeGerencia(programacao?.gerencia);
}

export function canEditProgramacao(user, programacao) {
  if (!user || !programacao) return false;
  if (isAdmin(user)) return true;
  if (programacao.criadoPor !== user.uid) return false;
  const s = normalizeStatus(programacao.status);
  return s === 'Rascunho' || s === STATUS_DEVOLVIDA;
}

export function canViewBI(user) {
  return isDiretoria(user);
}

export function canAccessAdmin(user) {
  return isDiretoria(user);
}

export function canManageUsers(user) {
  return isAdmin(user);
}

export function canViewGerencias(user) {
  return isDiretoria(user) || isGerencia(user);
}

export function canViewGerenciaTab(user, gerencia) {
  if (isDiretoria(user)) return true;
  if (!isGerencia(user)) return false;
  return normalizeGerencia(user.gerencia || currentGerencia) === normalizeGerencia(gerencia);
}

/** Aprovar / devolver na fila da Gerência */
export function canApproveGerencia(user, programacao) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!isGerencia(user) || !programacao) return false;
  const g = programacaoGerencia(programacao);
  return g && g === normalizeGerencia(user.gerencia || currentGerencia);
}

/** @deprecated use canApproveGerencia */
export function canApprove(user, programacao) {
  if (!programacao) return isAdmin(user) || isGerencia(user);
  return canApproveGerencia(user, programacao);
}

export function canDeleteProgramacao(user, programacao) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return programacao?.criadoPor === user.uid;
}

export function canSeeAuthor(user) {
  return isDiretoria(user) || isGerencia(user);
}

export function filterProgramacoesByAccess(programacoes, user) {
  const list = programacoes || [];
  if (isDiretoria(user)) return list;
  if (isGerencia(user)) {
    const g = normalizeGerencia(user.gerencia || currentGerencia);
    if (!g) return [];
    return list.filter((p) => programacaoGerencia(p) === g);
  }
  return list;
}
