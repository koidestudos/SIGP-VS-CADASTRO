import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getMunicipioById, getRegionalById, formatDate, COORDENACOES, MUNICIPIOS, REGIONAIS } from '../data/seed.js';
import { toast } from '../components/ui.js';

const RELATORIOS = [
  { id: 'mensal', nome: 'Programação Mensal', desc: 'Todas as ações do mês corrente' },
  { id: 'coord', nome: 'Programação por Coordenação', desc: 'Ações agrupadas por coordenação' },
  { id: 'mun', nome: 'Programação por Município', desc: 'Ações agrupadas por município' },
  { id: 'reg', nome: 'Programação por Regional', desc: 'Ações agrupadas por regional de saúde' },
  { id: 'concluidas', nome: 'Programações Concluídas', desc: 'Ações finalizadas' },
  { id: 'pendentes', nome: 'Programações Pendentes', desc: 'Ações aguardando aprovação' },
];

export function renderRelatorios(user) {
  return `
    <div class="page-header"><h2>Relatórios</h2></div>

    <div class="card mb-3">
      <div class="card-header"><h3>Exportar</h3></div>
      <div class="card-body">
        <button class="btn btn-outline" id="export-pdf">📄 Exportar PDF</button>
        <button class="btn btn-outline" id="export-excel">📊 Exportar Excel</button>
      </div>
    </div>

    <div class="grid-2">
      ${RELATORIOS.map((r) => `
        <div class="coord-card" data-relatorio="${r.id}">
          <h3>${r.nome}</h3>
          <p>${r.desc}</p>
          <button class="btn btn-primary btn-sm mt-2 btn-gerar-rel" data-relatorio="${r.id}">Gerar relatório</button>
        </div>
      `).join('')}
    </div>

    <div id="relatorio-output" class="card mt-3 hidden">
      <div class="card-header flex-between">
        <h3 id="relatorio-titulo">Relatório</h3>
        <button class="btn btn-ghost btn-sm" id="btn-print-rel">🖨 Imprimir</button>
      </div>
      <div class="card-body" id="relatorio-conteudo"></div>
    </div>
  `;
}

function filterProgramacoes(tipo) {
  const all = getCollection('programacoes');
  const now = new Date();
  const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  switch (tipo) {
    case 'mensal': return all.filter((p) => p.dataInicial.startsWith(mes));
    case 'concluidas': return all.filter((p) => p.status === 'Concluída');
    case 'pendentes': return all.filter((p) => p.status === 'Pendente');
    default: return all;
  }
}

function generateReportHTML(tipo, items) {
  const titulo = RELATORIOS.find((r) => r.id === tipo)?.nome || 'Relatório';

  if (tipo === 'coord') {
    const groups = {};
    items.forEach((p) => {
      const key = p.coordenacaoId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return `
      <h4>${titulo} — ${new Date().toLocaleDateString('pt-BR')}</h4>
      ${Object.entries(groups).map(([cid, progs]) => {
        const coord = getCoordenacaoById(cid);
        return `<h5 class="mt-2">${coord?.nome || cid} (${progs.length})</h5>
          ${renderTable(progs)}`;
      }).join('')}
    `;
  }

  if (tipo === 'mun') {
    const groups = {};
    items.forEach((p) => {
      if (!groups[p.municipioId]) groups[p.municipioId] = [];
      groups[p.municipioId].push(p);
    });
    return `
      <h4>${titulo} — ${new Date().toLocaleDateString('pt-BR')}</h4>
      ${Object.entries(groups).map(([mid, progs]) => {
        const mun = getMunicipioById(mid);
        return `<h5 class="mt-2">${mun?.nome || mid} (${progs.length})</h5>${renderTable(progs)}`;
      }).join('')}
    `;
  }

  if (tipo === 'reg') {
    const groups = {};
    items.forEach((p) => {
      if (!groups[p.regionalId]) groups[p.regionalId] = [];
      groups[p.regionalId].push(p);
    });
    return `
      <h4>${titulo} — ${new Date().toLocaleDateString('pt-BR')}</h4>
      ${Object.entries(groups).map(([rid, progs]) => {
        const reg = getRegionalById(rid);
        return `<h5 class="mt-2">${reg?.nome || rid} (${progs.length})</h5>${renderTable(progs)}`;
      }).join('')}
    `;
  }

  return `<h4>${titulo} — ${new Date().toLocaleDateString('pt-BR')}</h4>${renderTable(items)}`;
}

function renderTable(items) {
  if (!items.length) return '<p class="text-muted">Nenhum registro.</p>';
  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Ação</th><th>Coordenação</th><th>Município</th><th>Data</th><th>Responsável</th><th>Status</th></tr></thead>
        <tbody>
          ${items.map((p) => {
            const coord = getCoordenacaoById(p.coordenacaoId);
            const mun = getMunicipioById(p.municipioId);
            return `<tr>
              <td>${p.titulo}</td><td>${coord?.sigla || '—'}</td><td>${mun?.nome || '—'}</td>
              <td>${formatDate(p.dataInicial)}</td><td>${p.responsavel}</td><td>${p.status}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function exportCSV(items) {
  const header = 'Ação;Coordenação;Município;Data;Responsável;Status\n';
  const rows = items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipioById(p.municipioId);
    return `"${p.titulo}";"${coord?.sigla || ''}";"${mun?.nome || ''}";"${formatDate(p.dataInicial)}";"${p.responsavel}";"${p.status}"`;
  }).join('\n');

  const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sigp-vs-relatorio-${Date.now()}.csv`;
  link.click();
}

function exportPDF(items, titulo) {
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#1351B4;color:#fff}
    h1{color:#1351B4;font-size:18px}</style></head><body>
    <h1>SIGP-VS — ${titulo}</h1>
    <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    ${renderTable(items)}
    </body></html>
  `);
  win.document.close();
  win.print();
}

export function bindRelatorios(user) {
  document.querySelectorAll('.btn-gerar-rel').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.relatorio;
      const items = filterProgramacoes(tipo);
      const rel = RELATORIOS.find((r) => r.id === tipo);
      document.getElementById('relatorio-titulo').textContent = rel.nome;
      document.getElementById('relatorio-conteudo').innerHTML = generateReportHTML(tipo, items);
      document.getElementById('relatorio-output').classList.remove('hidden');
    });
  });

  document.getElementById('btn-print-rel')?.addEventListener('click', () => window.print());

  document.getElementById('export-excel')?.addEventListener('click', () => {
    exportCSV(getCollection('programacoes'));
    toast('Arquivo Excel (CSV) exportado!', 'success');
  });

  document.getElementById('export-pdf')?.addEventListener('click', () => {
    exportPDF(getCollection('programacoes'), 'Relatório Geral');
    toast('PDF gerado — use Imprimir → Salvar como PDF.', 'info');
  });
}
