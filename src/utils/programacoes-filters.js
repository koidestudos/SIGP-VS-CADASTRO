import {
  getCoordenacaoById, getMunicipioById, getGerenciaByProgramacao,
} from '../data/seed.js';
import { normalizeStatus } from './status.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function overlapsRange(prog, start, end) {
  if (!prog.dataInicial) return false;
  const ini = prog.dataInicial;
  const fim = prog.dataFinal || prog.dataInicial;
  return ini <= end && fim >= start;
}

export function weekRangeInMonth(yearMonth, weekNum) {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const w = Number(weekNum);
  const startDay = (w - 1) * 7 + 1;
  const endDay = Math.min(w * 7, daysInMonth);
  const pad = (n) => String(n).padStart(2, '0');
  const mm = pad(m);
  return {
    start: `${y}-${mm}-${pad(startDay)}`,
    end: `${y}-${mm}-${pad(endDay)}`,
  };
}

export function monthRange(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  const mm = pad(m);
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${pad(daysInMonth)}` };
}

/** Lê o estado atual dos filtros a partir do DOM */
export function readFilterState() {
  const tipo = document.getElementById('filtro-periodo-tipo')?.value || 'todas';
  return {
    tipo,
    dataIni: document.getElementById('filtro-data-ini')?.value || '',
    dataFim: document.getElementById('filtro-data-fim')?.value || '',
    semanaMes: document.getElementById('filtro-semana-mes')?.value || '',
    semanaNum: document.getElementById('filtro-semana-num')?.value || '1',
    mes: document.getElementById('filtro-mes')?.value || '',
    busca: document.getElementById('filtro-busca')?.value?.toLowerCase().trim() || '',
    gerencia: document.getElementById('filtro-gerencia')?.value || '',
    coord: document.getElementById('filtro-coord')?.value || '',
    status: document.getElementById('filtro-status')?.value || '',
  };
}

export function getPeriodRange(state = readFilterState()) {
  if (state.tipo === 'intervalo' && state.dataIni && state.dataFim) {
    return { start: state.dataIni, end: state.dataFim };
  }
  if (state.tipo === 'semana' && state.semanaMes) {
    return weekRangeInMonth(state.semanaMes, state.semanaNum);
  }
  if (state.tipo === 'mes' && state.mes) {
    return monthRange(state.mes);
  }
  return null;
}

export function getFilterDescription(state = readFilterState()) {
  const range = getPeriodRange(state);
  if (state.tipo === 'todas' || !range) return 'Todas as programações';
  if (state.tipo === 'intervalo') {
    const fmt = (d) => d.split('-').reverse().join('/');
    return `Período: ${fmt(range.start)} até ${fmt(range.end)}`;
  }
  if (state.tipo === 'semana') {
    const [y, m] = (state.semanaMes || '').split('-').map(Number);
    const semanaLabel = ['1ª', '2ª', '3ª', '4ª', '5ª'][Number(state.semanaNum) - 1] || `${state.semanaNum}ª`;
    return `${semanaLabel} Semana de ${MESES[m - 1]}/${y}`;
  }
  if (state.tipo === 'mes') {
    const [y, m] = state.mes.split('-').map(Number);
    return `Mês: ${MESES[m - 1]}/${y}`;
  }
  return 'Filtro ativo';
}

export function filterProgramacoes(items, state = readFilterState()) {
  let result = [...items];
  const range = getPeriodRange(state);

  if (range) {
    result = result.filter((p) => overlapsRange(p, range.start, range.end));
  }

  if (state.busca) {
    result = result.filter((p) => {
      const mun = getMunicipioById(p.municipioId)?.nome || '';
      const coordNome = getCoordenacaoById(p.coordenacaoId)?.nome || '';
      const eq = (p.equipe || []).map((e) => e.nome).join(' ');
      return [p.titulo, p.responsavel, p.objetivo, mun, coordNome, eq].join(' ').toLowerCase().includes(state.busca);
    });
  }
  if (state.gerencia) result = result.filter((p) => getGerenciaByProgramacao(p) === state.gerencia);
  if (state.coord) result = result.filter((p) => p.coordenacaoId === state.coord);
  if (state.status) result = result.filter((p) => normalizeStatus(p.status) === state.status);

  return result;
}

export function toggleFilterPanels() {
  const tipo = document.getElementById('filtro-periodo-tipo')?.value || 'todas';
  const show = (id, vis) => document.getElementById(id)?.classList.toggle('hidden', !vis);
  show('filtro-intervalo-panel', tipo === 'intervalo');
  show('filtro-intervalo-panel-fim', tipo === 'intervalo');
  show('filtro-semana-panel', tipo === 'semana');
  show('filtro-semana-panel-num', tipo === 'semana');
  show('filtro-mes-panel', tipo === 'mes');
}
