import { getProgramacoes } from '../services/programacoes-service.js';
import {
  getCoordenacaoById, getRegionalById, formatDate,
  getGerenciaByProgramacao, COORDENACOES, getMunicipiosLabel,
} from '../data/seed.js';
import { toast } from '../components/ui.js';
import { normalizeStatus, isInBI, needsApproval } from '../utils/status.js';

const RELATORIOS = [
  { id: 'mensal', nome: 'Programação Mensal' },
  { id: 'coord', nome: 'Programação por Coordenação' },
  { id: 'mun', nome: 'Programação por Município' },
  { id: 'reg', nome: 'Programação por Regional' },
  { id: 'aprovadas', nome: 'Viagens Autorizadas (BI)' },
  { id: 'pendentes', nome: 'Programações em Análise' },
];

function renderTable(items) {
  if (!items.length) return '<p class="text-muted">Nenhum registro no período.</p>';
  return `<table><thead><tr>
    <th>Ação</th><th>Gerência</th><th>Coordenação</th><th>Município</th><th>Data Ida</th><th>Data Volta</th><th>Responsável</th><th>Status</th>
  </tr></thead><tbody>${items.map((p) => {
    const c = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipiosLabel(p);
    return `<tr><td>${p.titulo}</td><td>${getGerenciaByProgramacao(p)}</td><td>${c?.sigla||'—'}</td><td>${mun}</td>
      <td>${formatDate(p.dataInicial)}</td><td>${formatDate(p.dataFinal)}</td><td>${p.responsavel}</td><td>${normalizeStatus(p.status)}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function filterByDateRange(items, ini, fim) {
  if (!ini && !fim) return items;
  return items.filter((p) => {
    if (ini && p.dataFinal < ini) return false;
    if (fim && p.dataInicial > fim) return false;
    return true;
  });
}

function exportPDF(items, titulo, periodo) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #ccc;padding:6px}th{background:#1351B4;color:#fff}h1{color:#1351B4;font-size:18px}</style></head><body>
    <h1>SIGP-VS — ${titulo}</h1>
    ${periodo ? `<p>Período de viagem: ${periodo}</p>` : ''}
    <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    ${renderTable(items)}
    </body></html>`);
  win.document.close();
  win.print();
}

function exportCSV(items) {
  const header = 'Ação;Gerência;Coordenação;Município;Data Ida;Data Volta;Responsável;Status\n';
  const rows = items.map((p) => {
    const c = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipiosLabel(p);
    return `"${p.titulo}";"${getGerenciaByProgramacao(p)}";"${c?.sigla||''}";"${mun}";"${formatDate(p.dataInicial)}";"${formatDate(p.dataFinal)}";"${p.responsavel}";"${normalizeStatus(p.status)}"`;
  }).join('\n');
  const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sigp-vs-${Date.now()}.csv`;
  a.click();
}

export function renderRelatorios() {
  const hoje = new Date().toISOString().split('T')[0];
  return `
    <div class="page-header"><h2>Relatórios</h2></div>
    <div class="card mb-3">
      <div class="card-header"><h3>Exportar PDF por período de viagem</h3></div>
      <div class="card-body">
        <div class="filters-bar">
          <div class="form-group"><label>Data Ida (de)</label><input type="date" class="form-control" id="pdf-data-ini" /></div>
          <div class="form-group"><label>Data Volta (até)</label><input type="date" class="form-control" id="pdf-data-fim" value="${hoje}" /></div>
          <button class="btn btn-primary" id="export-pdf-range">📄 Exportar PDF do período</button>
        </div>
        <p class="text-sm text-muted">Exporta apenas programações com viagem entre as datas informadas.</p>
      </div>
    </div>
    <div class="card mb-3">
      <div class="card-body">
        <button class="btn btn-outline" id="export-pdf-all">📄 Exportar PDF completo</button>
        <button class="btn btn-outline" id="export-excel">📊 Exportar Excel</button>
      </div>
    </div>
    <div class="grid-2">${RELATORIOS.map((r) => `
      <div class="coord-card"><h3>${r.nome}</h3>
      <button class="btn btn-primary btn-sm mt-2 btn-gerar-rel" data-relatorio="${r.id}">Gerar</button></div>`).join('')}
    </div>
    <div id="relatorio-output" class="card mt-3 hidden">
      <div class="card-header flex-between"><h3 id="relatorio-titulo">Relatório</h3>
        <button class="btn btn-ghost btn-sm" id="btn-print-rel">🖨 Imprimir</button></div>
      <div class="card-body" id="relatorio-conteudo"></div>
    </div>`;
}

export function bindRelatorios() {
  document.getElementById('export-pdf-range')?.addEventListener('click', () => {
    const ini = document.getElementById('pdf-data-ini').value;
    const fim = document.getElementById('pdf-data-fim').value;
    if (!ini || !fim) { toast('Informe data de ida e volta.', 'error'); return; }
    const items = filterByDateRange(getProgramacoes(), ini, fim);
    exportPDF(items, 'Programação de Viagens', `${formatDate(ini)} a ${formatDate(fim)}`);
    toast(`${items.length} programação(ões) exportada(s).`, 'success');
  });
  document.getElementById('export-pdf-all')?.addEventListener('click', () => exportPDF(getProgramacoes(), 'Relatório Geral'));
  document.getElementById('export-excel')?.addEventListener('click', () => { exportCSV(getProgramacoes()); toast('Excel exportado.', 'success'); });
  document.getElementById('btn-print-rel')?.addEventListener('click', () => window.print());
  document.querySelectorAll('.btn-gerar-rel').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.relatorio;
      let items = getProgramacoes();
      const now = new Date();
      const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (tipo === 'mensal') items = items.filter((p) => p.dataInicial?.startsWith(mes));
      if (tipo === 'aprovadas') items = items.filter((p) => isInBI(p.status));
      if (tipo === 'pendentes') items = items.filter((p) => needsApproval(p.status));
      document.getElementById('relatorio-titulo').textContent = RELATORIOS.find((r) => r.id === tipo).nome;
      document.getElementById('relatorio-conteudo').innerHTML = renderTable(items);
      document.getElementById('relatorio-output').classList.remove('hidden');
    });
  });
}
