import {
  getCoordenacaoById, getMunicipioById, getGerenciaByProgramacao,
  GERENCIAS, COORDENACOES, getMunicipioIdsFromProgramacao,
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
      const muns = getMunicipioIdsFromProgramacao(p).map((id) => getMunicipioById(id)?.nome || '').join(' ');
      const coordNome = getCoordenacaoById(p.coordenacaoId)?.nome || '';
      const eq = (p.equipe || []).map((e) => e.nome).join(' ');
      return [p.titulo, p.responsavel, p.objetivo, muns, coordNome, eq].join(' ').toLowerCase().includes(state.busca);
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

/** Barra de filtros compartilhada (Programações, Logística) */
export function renderProgramacoesFilterBar({
  mesAtual,
  showPdfButton = false,
  resumoId = 'filtro-resumo',
  statusOptions = [],
  resumoText = 'Exibindo todas as programações',
} = {}) {
  const now = new Date();
  const mes = mesAtual || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const statusHtml = statusOptions.length
    ? statusOptions.map((s) => `<option>${s}</option>`).join('')
    : '';

  return `
    <div class="filters-bar filters-bar-prog">
      <div class="form-group"><label>Período</label>
        <select class="form-control" id="filtro-periodo-tipo">
          <option value="todas" selected>Todas</option>
          <option value="intervalo">De / até (datas)</option>
          <option value="semana">Semana do mês</option>
          <option value="mes">Mês inteiro</option>
        </select>
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-intervalo-panel">
        <label>De</label>
        <input type="date" class="form-control" id="filtro-data-ini" />
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-intervalo-panel-fim">
        <label>Até</label>
        <input type="date" class="form-control" id="filtro-data-fim" />
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-semana-panel">
        <label>Mês de referência</label>
        <input type="month" class="form-control" id="filtro-semana-mes" value="${mes}" />
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-semana-panel-num">
        <label>Semana</label>
        <select class="form-control" id="filtro-semana-num">
          <option value="1">1ª Semana</option>
          <option value="2">2ª Semana</option>
          <option value="3">3ª Semana</option>
          <option value="4">4ª Semana</option>
          <option value="5">5ª Semana</option>
        </select>
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-mes-panel">
        <label>Mês</label>
        <input type="month" class="form-control" id="filtro-mes" value="${mes}" />
      </div>
      <div class="form-group flex-2"><label>Buscar</label>
        <input type="search" class="form-control" id="filtro-busca" placeholder="Título, município, equipe..." /></div>
      <div class="form-group"><label>Gerência</label><select class="form-control" id="filtro-gerencia"><option value="">Todas</option>
        ${GERENCIAS.map((g) => `<option value="${g}">${g}</option>`).join('')}</select></div>
      <div class="form-group"><label>Coordenação</label><select class="form-control" id="filtro-coord"><option value="">Todas</option>
        ${COORDENACOES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
      ${statusOptions.length ? `<div class="form-group"><label>Status</label><select class="form-control" id="filtro-status"><option value="">Todos</option>
        ${statusHtml}</select></div>` : ''}
      ${showPdfButton ? `<div class="form-group">
        <label>&nbsp;</label>
        <button type="button" class="btn btn-outline btn-sm" id="btn-download-filtro">⬇ Baixar relatório do filtro</button>
      </div>` : ''}
    </div>
    <p class="text-sm text-muted mb-2" id="${resumoId}">${resumoText}</p>`;
}

export function bindProgramacoesFilterBar(refresh) {
  toggleFilterPanels();
  document.getElementById('filtro-periodo-tipo')?.addEventListener('change', () => {
    toggleFilterPanels();
    refresh();
  });
  [
    'filtro-data-ini', 'filtro-data-fim', 'filtro-semana-mes', 'filtro-semana-num',
    'filtro-mes', 'filtro-coord', 'filtro-status', 'filtro-gerencia',
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', refresh);
  });
  document.getElementById('filtro-busca')?.addEventListener('input', refresh);
}
