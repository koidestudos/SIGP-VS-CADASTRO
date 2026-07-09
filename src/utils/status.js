/** Normaliza status legado e exibição */
export function normalizeStatus(status) {
  if (status === 'Aprovado') return 'Autorizado';
  return status || '';
}

export function isAutorizado(status) {
  return status === 'Autorizado' || status === 'Aprovado';
}

export function isPublicada(status) {
  return ['Programada', 'Autorizado', 'Aprovado'].includes(status);
}
