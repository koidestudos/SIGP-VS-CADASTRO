/** Papéis: usuario (membro), gerencia, diretoria, admin */

export const ROLE_USUARIO = 'usuario';
export const ROLE_GERENCIA = 'gerencia';
export const ROLE_DIRETORIA = 'diretoria';
export const ROLE_ADMIN = 'admin';

export const GERENCIAS = ['GAS', 'GVS', 'GAP'];

export const MSG_EDICAO_NEGADA = 'Você não possui permissão para editar esta programação. Somente o responsável pelo cadastro pode alterar seu conteúdo.';
export const MSG_PRIORIZADA_SEMANA = 'Esta gerência já possui uma programação priorizada nesta semana. Altere a programação já priorizada ou escolha outra semana.';

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
  currentGerencia = normalizeGerencia(extra.gerenciaId || extra.gerencia);
}

export function getUserRole() {
  return currentRole;
}

export function getUserGerencia() {
  return currentGerencia;
}

function roleOf(user) {
  if (user && typeof user === 'object') {
    return normalizeRole(user.perfil || user.role);
  }
  return currentRole;
}

export function userGerenciaId(user) {
  if (user && typeof user === 'object') {
    return normalizeGerencia(user.gerenciaId || user.gerencia) || currentGerencia;
  }
  return currentGerencia;
}

/** Autoria: campo novo ou legado. Vazio = sem autor validado. */
export function programacaoAutorUid(programacao) {
  return String(programacao?.criadoPorUid || programacao?.criadoPor || '').trim();
}

export function programacaoGerencia(programacao) {
  return normalizeGerencia(programacao?.gerenciaId || programacao?.gerencia);
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

export function isMembro(user) {
  return isCoordenacao(user);
}

export function roleLabel(user) {
  const role = roleOf(user);
  if (role === ROLE_ADMIN) return 'Administrador';
  if (role === ROLE_DIRETORIA) return 'Diretoria';
  if (role === ROLE_GERENCIA) {
    const g = userGerenciaId(user);
    return g ? `Gerência ${g}` : 'Gerência';
  }
  return 'Membro';
}

export function canCreateProgramacao(user) {
  return isAdmin(user) || isGerencia(user) || isMembro(user);
}

export function canUpdateLogistica(user) {
  return isAdmin(user) || isGerencia(user);
}

export function canEdit(user) {
  return isAdmin(user);
}

export function isAutorDaProgramacao(user, programacao) {
  if (!user?.uid || !programacao) return false;
  const author = programacaoAutorUid(programacao);
  return Boolean(author) && author === user.uid;
}

/** Editar conteúdo: admin, ou autor (membro/gerente). Sem autor legado → só admin. */
export function canEditProgramacao(user, programacao) {
  if (!user || !programacao) return false;
  if (isAdmin(user)) return true;
  if (!isMembro(user) && !isGerencia(user)) return false;
  return isAutorDaProgramacao(user, programacao);
}

export function sameGerencia(user, programacao) {
  const g = programacaoGerencia(programacao);
  const mine = userGerenciaId(user);
  return Boolean(g && mine && g === mine);
}

/** Alterar somente o status: admin ou gerente da mesma gerência. */
export function canChangeProgramacaoStatus(user, programacao) {
  if (!user || !programacao) return false;
  if (isAdmin(user)) return true;
  if (!isGerencia(user)) return false;
  return sameGerencia(user, programacao);
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
  return userGerenciaId(user) === normalizeGerencia(gerencia);
}

export function canApproveGerencia(user, programacao) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!isGerencia(user) || !programacao) return false;
  return sameGerencia(user, programacao);
}

/** @deprecated use canApproveGerencia */
export function canApprove(user, programacao) {
  if (!programacao) return isAdmin(user) || isGerencia(user);
  return canApproveGerencia(user, programacao);
}

export function canDeleteProgramacao(user, _programacao) {
  return isAdmin(user);
}

/** Botões da listagem: editar conteúdo ≠ alterar status. Admin = permissão total. */
export function programacaoActionFlags(user, programacao) {
  if (isAdmin(user)) {
    return {
      view: true,
      edit: true,
      changeStatus: true,
      approve: true,
      reject: true,
      del: true,
      anexar: true,
      duplicate: true,
    };
  }
  const changeStatus = canChangeProgramacaoStatus(user, programacao);
  return {
    view: true,
    edit: canEditProgramacao(user, programacao),
    changeStatus,
    approve: changeStatus,
    reject: changeStatus,
    del: false,
    anexar: false,
    duplicate: canEditProgramacao(user, programacao),
  };
}

export function statusChangeConfirmMessage(statusAtual, statusNovo) {
  return `Deseja alterar o status desta programação de ‘${statusAtual}’ para ‘${statusNovo}’?`;
}

export function canSeeAuthor(user) {
  return isDiretoria(user) || isGerencia(user);
}

export function canSeeHistory(user, programacao) {
  if (isAdmin(user) || isDiretoria(user)) return true;
  if (isGerencia(user) && programacao) return sameGerencia(user, programacao);
  return false;
}

export function filterProgramacoesByAccess(programacoes, user) {
  const list = programacoes || [];
  if (isAdmin(user) || isDiretoria(user)) return list;
  if (isGerencia(user)) {
    const g = userGerenciaId(user);
    if (!g) return [];
    return list.filter((p) => programacaoGerencia(p) === g);
  }
  return list;
}
