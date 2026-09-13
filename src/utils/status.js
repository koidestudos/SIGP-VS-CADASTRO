/** Status da Programação — fluxo SIGP-VS (Coordenação → Gerência → Diretoria acompanha) */

export const STATUS_AGUARDANDO_GERENCIA = 'Aguardando aprovação da Gerência';
export const STATUS_DEVOLVIDA = 'Devolvida para correção';
export const STATUS_REENVIADA = 'Reenviada para análise';
export const STATUS_APROVADA_GERENCIA = 'Aprovada pela Gerência';

export const STATUS_PROGRAMACAO = [
  'Rascunho',
  STATUS_AGUARDANDO_GERENCIA,
  STATUS_DEVOLVIDA,
  STATUS_REENVIADA,
  STATUS_APROVADA_GERENCIA,
  'Programada',
  'Priorizada',
  'Autorizada',
  'Em execução',
  'Realizada',
  'Cancelada',
  'Reprovada',
];

export const GERENCIAS_TABS = ['GAS', 'GVS', 'GAP'];

/** Status que entram no BI Gerencial e indicadores públicos */
export const STATUS_IN_BI = ['Aprovada pela Gerência', 'Autorizada', 'Em execução', 'Realizada'];

/** Status visíveis no Dashboard operacional */
export const STATUS_IN_DASHBOARD = [
  STATUS_APROVADA_GERENCIA,
  'Programada',
  'Priorizada',
  'Autorizada',
  'Em execução',
  'Realizada',
];

const LEGACY_MAP = {
  Aprovado: 'Autorizada',
  Autorizado: 'Autorizada',
  'Em análise': 'Programada',
  Pendente: 'Programada',
  'Enviado para Diretoria': STATUS_AGUARDANDO_GERENCIA,
  'Enviada para Gerência': STATUS_AGUARDANDO_GERENCIA,
};

/** Normaliza status legado para o fluxo atual */
export function normalizeStatus(status) {
  if (!status) return '';
  return LEGACY_MAP[status] || status;
}

export function isInBI(status) {
  return STATUS_IN_BI.includes(normalizeStatus(status));
}

export function isInDashboard(status) {
  return STATUS_IN_DASHBOARD.includes(normalizeStatus(status));
}

export function isAutorizada(status) {
  const s = normalizeStatus(status);
  return s === 'Autorizada' || s === 'Em execução' || s === STATUS_APROVADA_GERENCIA;
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

export function isPendenteGerencia(status) {
  const s = normalizeStatus(status);
  return s === STATUS_AGUARDANDO_GERENCIA || s === STATUS_REENVIADA;
}

export function isDevolvidaGerencia(status) {
  return normalizeStatus(status) === STATUS_DEVOLVIDA;
}

export function isAprovadaGerencia(status) {
  return normalizeStatus(status) === STATUS_APROVADA_GERENCIA;
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
    [STATUS_AGUARDANDO_GERENCIA]: 'badge-enviada',
    [STATUS_DEVOLVIDA]: 'badge-devolvida',
    [STATUS_REENVIADA]: 'badge-reenviada',
    [STATUS_APROVADA_GERENCIA]: 'badge-aprovada-gerencia',
    Programada: 'badge-programada',
    Priorizada: 'badge-priorizada',
    Autorizada: 'badge-autorizada',
    'Em execução': 'badge-execucao',
    Realizada: 'badge-realizada',
    Cancelada: 'badge-cancelada',
    Reprovada: 'badge-reprovada',
  };
  return map[s] || 'badge-rascunho';
}

/** Classe CSS para colorir a linha inteira na tabela de programações */
export function getStatusRowClass(status) {
  const s = normalizeStatus(status);
  const map = {
    Rascunho: 'row-status-rascunho',
    [STATUS_AGUARDANDO_GERENCIA]: 'row-status-enviada',
    [STATUS_DEVOLVIDA]: 'row-status-devolvida',
    [STATUS_REENVIADA]: 'row-status-reenviada',
    [STATUS_APROVADA_GERENCIA]: 'row-status-autorizada',
    Programada: 'row-status-programada',
    Priorizada: 'row-status-priorizada',
    Autorizada: 'row-status-autorizada',
    'Em execução': 'row-status-execucao',
    Realizada: 'row-status-realizada',
    Cancelada: 'row-status-cancelada',
    Reprovada: 'row-status-reprovada',
  };
  return map[s] || 'row-status-rascunho';
}

/** Opções de status que o usuário pode selecionar no dropdown */
export function getStatusOptionsForUser(user, programacao) {
  const current = normalizeStatus(programacao?.status);
  const role = user?.role;
  const isOwner = programacao?.criadoPor === user?.uid;

  if (role === 'admin') return [...STATUS_PROGRAMACAO];
  if (role === 'diretoria') return [current];

  if (role === 'gerencia') return [current];

  if (!isOwner) return [current];

  const coordOptions = {
    Rascunho: ['Rascunho', STATUS_AGUARDANDO_GERENCIA],
    [STATUS_AGUARDANDO_GERENCIA]: [STATUS_AGUARDANDO_GERENCIA],
    [STATUS_DEVOLVIDA]: [STATUS_DEVOLVIDA, STATUS_REENVIADA],
    [STATUS_REENVIADA]: [STATUS_REENVIADA],
    [STATUS_APROVADA_GERENCIA]: [STATUS_APROVADA_GERENCIA],
    Programada: ['Programada'],
    Priorizada: ['Priorizada'],
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

export function filterForDashboard(programacoes) {
  return programacoes.filter((p) => isInDashboard(p.status));
}

/** Itens na fila da Gerência (aguardando análise) */
export function needsGerenciaApproval(status) {
  return isPendenteGerencia(status);
}

/** @deprecated use needsGerenciaApproval — mantido para telas antigas do admin */
export function needsApproval(status) {
  return needsGerenciaApproval(status);
}

export function countByStatusGroup(programacoes) {
  const counts = Object.fromEntries(STATUS_PROGRAMACAO.map((s) => [s, 0]));
  programacoes.forEach((p) => {
    const s = normalizeStatus(p.status);
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}

export function countPendenciasGerencia(programacoes, gerencia) {
  return programacoes.filter((p) => {
    if (!needsGerenciaApproval(p.status)) return false;
    if (!gerencia) return true;
    return String(p.gerencia || '').toUpperCase() === String(gerencia).toUpperCase();
  }).length;
}

export function gerenciaStatusGroup(status) {
  const s = normalizeStatus(status);
  if (isPendenteGerencia(s)) return 'pendentes';
  if (s === STATUS_APROVADA_GERENCIA) return 'aprovadas';
  if (s === STATUS_DEVOLVIDA) return 'devolvidas';
  return 'outras';
}
