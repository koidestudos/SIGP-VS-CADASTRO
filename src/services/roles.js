/** Papéis do usuário logado (carregados do Firestore) */
let currentRole = 'usuario';

export function setUserRole(role) {
  currentRole = role === 'admin' ? 'admin' : 'usuario';
}

export function getUserRole() {
  return currentRole;
}

export function isAdmin(user) {
  return user?.role === 'admin' || currentRole === 'admin';
}

export function canEdit(user) {
  return Boolean(user);
}

export function canEditProgramacao(user, programacao) {
  if (!user || !programacao) return false;
  if (isAdmin(user)) return true;
  return programacao.criadoPor === user.uid;
}

export function canViewBI(user) {
  return isAdmin(user);
}

export function canApprove(user) {
  return isAdmin(user);
}

export function canDeleteProgramacao(user, programacao) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return programacao?.criadoPor === user.uid;
}
