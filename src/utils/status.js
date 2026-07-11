/** Status da Programação — fluxo SIGP-VS */

export const STATUS_PROGRAMACAO = [
  'Rascunho',
  'Enviada para Gerência',
  'Programada',
  'Autorizada',
  'Em execução',
  'Realizada',
  'Cancelada',
  'Reprovada',
];

/** Status que entram no BI Gerencial e indicadores públicos */
export const STATUS_IN_BI = ['Autorizada', 'Em execução', 'Realizada'];

const LEGACY_MAP = {
  Aprovado: 'Autorizada',
  Autorizado: 'Autorizada',
  'Em análise': 'Programada',
  Pendente: 'Programada',
};

/** Normaliza status legado para o fluxo atual */
export function normalizeStatus(status) {
  if (!status) return '';
  return LEGACY_MAP[status] || status;
}

export function isInBI(status) {
  return STATUS_IN_BI.includes(normalizeStatus(status));
}

export function isAutorizada(status) {
  const s = normalizeStatus(status);
  return s === 'Autorizada' || s === 'Em execução';
}

export function isRealizada(status) {
  return normalizeStatus(status) === 'Realizada';
}

/** @deprecated use isAutorizada */
export function isAutorizado(status) {
  return isAutorizada(status);
}

export function isGestaoOnly(status) {
  return !isInBI(status) && normalizeStatus(status) !== 'Cancelada';
}

/** Programações reprovadas ou canceladas não permitem anexo */
export function canAttachAnexo(status) {
  const s = normalizeStatus(status);
  return s !== 'Reprovada' && s !== 'Cancelada';
}

export function getStatusBadgeClass(status) {
  const s = normalizeStatus(status);
  const map = {
    Rascunho: 'badge-rascunho',
    'Enviada para Gerência': 'badge-enviada',
    Programada: 'badge-programada',
    Autorizada: 'badge-autorizada',
    'Em execução': 'badge-execucao',
    Realizada: 'badge-realizada',
    Cancelada: 'badge-cancelada',
    Reprovada: 'badge-reprovada',
  };
  return map[s] || 'badge-rascunho';
}

/** Opções de status que o usuário pode selecionar */
export function getStatusOptionsForUser(user, programacao) {
  const current = normalizeStatus(programacao?.status);
  const isAdmin = user?.role === 'admin';
  const isOwner = programacao?.criadoPor === user?.uid;

  if (isAdmin) return [...STATUS_PROGRAMACAO];

  if (!isOwner) return [current];

  const coordOptions = {
    Rascunho: ['Rascunho', 'Enviada para Gerência'],
    'Enviada para Gerência': ['Enviada para Gerência'],
    Programada: ['Programada'],
    Autorizada: ['Autorizada', 'Em execução', 'Realizada'],
    'Em execução': ['Em execução', 'Realizada'],
    Realizada: ['Realizada'],
    Cancelada: ['Cancelada'],
    Reprovada: ['Reprovada'],
  };
  return coordOptions[current] || [current];
}

export function filterForBI(programacoes) {
  return programacoes.filter((p) => isInBI(p.status));
}

export function needsApproval(status) {
  const s = normalizeStatus(status);
  return ['Enviada para Gerência', 'Programada'].includes(s)
    || status === 'Pendente' || status === 'Em análise';
}

export function countByStatusGroup(programacoes) {
  const counts = Object.fromEntries(STATUS_PROGRAMACAO.map((s) => [s, 0]));
  programacoes.forEach((p) => {
    const s = normalizeStatus(p.status);
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}
