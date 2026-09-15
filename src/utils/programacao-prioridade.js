import { normalizeStatus } from './status.js';
import { programacaoNaSemana, weekRangeContainingDateBR } from './datetime-br.js';
import { programacaoGerencia } from '../services/roles.js';

export function findPriorizadaConflito(programacoes, {
  gerencia,
  dataInicial,
  excludeId = '',
} = {}) {
  const g = String(gerencia || '').toUpperCase();
  if (!g || !dataInicial) return null;
  const week = weekRangeContainingDateBR(dataInicial);
  return (programacoes || []).find((p) => {
    if (excludeId && p.id === excludeId) return false;
    if (normalizeStatus(p.status) !== 'Priorizada') return false;
    if (programacaoGerencia(p) !== g) return false;
    return programacaoNaSemana(p, week.start, week.end);
  }) || null;
}
