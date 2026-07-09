import { getProgramacoes } from '../services/programacoes-service.js';
import {
  getProgramacoesForBI, countServidores, countByGerencia, countByCoordenacao, countByMunicipio,
  countByRegional, countByMonth, countByTipo, countByPublico, countByStatus,
  countByDay, logisticaStats, proximasAcoes,
  municipioStats,
} from '../utils/bi-metrics.js';
import { formatDate, getGerenciaByProgramacao, getCoordenacaoById, getMunicipioById, GERENCIAS } from '../data/seed.js';
import { renderDonutChart, renderBarChart, renderHorizontalBarChart } from '../components/charts.js';
import { renderPiauiHeatMap, bindPiauiHeatMap } from '../components/piaui-map.js';
import { bindTabs } from '../components/ui.js';
import { downloadBiReportPdf } from '../utils/bi-report-pdf.js';

const BI_TABS = [
  { id: 'painel', label: 'Painel Executivo' },
  { id: 'coord', label: 'Por Coordenação' },
  { id: 'mun', label: 'Por Município' },
  { id: 'reg', label: 'Por Regional' },
  { id: 'mensal', label: 'BI Mensal' },
  { id: 'tipo', label: 'Tipo de Ação' },
  { id: 'publico', label: 'Público-Alvo' },
  { id: 'log', label: 'Logístico' },
  { id: 'status', label: 'Status' },
  { id: 'cal', label: 'Calendário' },
];

export function renderBiGerencial() {
  const programacoes = getProgramacoesForBI(getProgramacoes());
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();
  const doMes = programacoes.filter((p) => {
    const d = new Date(p.dataInicial + 'T12:00:00');
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const porGerencia = countByGerencia(programacoes);
  const porCoord = countByCoordenacao(programacoes);
  const porRegional = countByRegional(programacoes);
  const porMes = countByMonth(programacoes, anoAtual);
  const porTipo = countByTipo(programacoes);
  const porPublico = countByPublico(programacoes);
  const porStatus = countByStatus(programacoes);
  const { transporte, alimentacao } = logisticaStats(programacoes);
  const dayCounts = countByDay(programacoes);
  const { hoje, amanha, semana } = proximasAcoes(programacoes);

  return `
    <div class="bi-page">
      <div class="bi-hero">
        <div>
          <h2>📊 BI Gerencial</h2>
          <p class="text-muted">Inclui apenas programações Autorizadas, Em execução e Realizadas — atualizado em tempo real</p>
        </div>
        <button type="button" class="btn btn-outline" id="btn-download-bi">⬇ Baixar relatório PDF</button>
      </div>

      <div class="bi-exec-summary">
        <div class="bi-exec-card"><span>📅 Programações do mês</span><strong>${doMes.length}</strong></div>
        <div class="bi-exec-card"><span>📍 Municípios</span><strong>${new Set(programacoes.map((p) => p.municipioId)).size}</strong></div>
        <div class="bi-exec-card"><span>🏢 Coordenações</span><strong>${new Set(programacoes.map((p) => p.coordenacaoId)).size}</strong></div>
        <div class="bi-exec-card"><span>👥 Servidores</span><strong>${countServidores(programacoes)}</strong></div>
      </div>

      <div class="tabs bi-tabs" id="bi-tabs">
        ${BI_TABS.map((t, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>

      <div class="tab-content active" data-tab-content="painel">
        <div class="kpi-grid-6">
          <div class="kpi-card"><div class="kpi-icon blue">📅</div><div><strong>${programacoes.length}</strong><span>Total de Programações</span></div></div>
          <div class="kpi-card"><div class="kpi-icon green">🏢</div><div><strong>${new Set(programacoes.map((p) => p.coordenacaoId)).size}</strong><span>Coordenações ativas</span></div></div>
          <div class="kpi-card"><div class="kpi-icon teal">📍</div><div><strong>${new Set(programacoes.map((p) => p.municipioId)).size}</strong><span>Municípios atendidos</span></div></div>
          <div class="kpi-card"><div class="kpi-icon purple">👥</div><div><strong>${countServidores(programacoes)}</strong><span>Servidores envolvidos</span></div></div>
          <div class="kpi-card"><div class="kpi-icon orange">🚗</div><div><strong>${transporte.length}</strong><span>Com transporte</span></div></div>
          <div class="kpi-card"><div class="kpi-icon gold">🍽</div><div><strong>${alimentacao.length}</strong><span>Com alimentação</span></div></div>
        </div>
        <div class="charts-row-2 mt-3">
          <div class="card chart-card"><div class="card-header"><h3>Programações por Regional</h3></div>
            <div class="card-body">${renderHorizontalBarChart(porRegional.slice(0, 8).map((r) => ({ label: r.nome.replace('Regional ', ''), value: r.programacoes, color: '#1351B4' })))}</div></div>
          <div class="card chart-card"><div class="card-header"><h3>Programações por Gerência</h3></div>
            <div class="card-body">${renderHorizontalBarChart(porGerencia.filter((g) => g.value > 0))}</div></div>
        </div>
        <div class="card mt-3"><div class="card-header"><h3>Próximas ações</h3></div><div class="card-body">
          <div class="grid-3">
            <div><h4>Hoje (${hoje.length})</h4><ul class="bi-list">${hoje.slice(0, 4).map((p) => `<li>${p.titulo}</li>`).join('') || '<li class="text-muted">—</li>'}</ul></div>
            <div><h4>Amanhã (${amanha.length})</h4><ul class="bi-list">${amanha.slice(0, 4).map((p) => `<li>${p.titulo}</li>`).join('') || '<li class="text-muted">—</li>'}</ul></div>
            <div><h4>Próxima semana (${semana.length})</h4><ul class="bi-list">${semana.slice(0, 4).map((p) => `<li>${p.titulo}</li>`).join('') || '<li class="text-muted">—</li>'}</ul></div>
          </div>
        </div></div>
      </div>

      <div class="tab-content" data-tab-content="coord">
        <div class="card"><div class="card-header"><h3>BI por Coordenação</h3></div>
          <div class="card-body">${renderHorizontalBarChart(porCoord.slice(0, 14).map((c, i) => ({
            label: `${c.label} (${c.gerencia})`,
            value: c.value,
            color: ['#1351B4', '#168821', '#ca8a04'][GERENCIAS.indexOf(c.gerencia)] || '#64748b',
          })))}</div></div>
      </div>

      <div class="tab-content" data-tab-content="mun">
        <div class="charts-row-2">
          <div class="card chart-card"><div class="card-header"><h3>Mapa do Piauí — intensidade de ações</h3>
            <span class="text-sm text-muted">Quanto mais escuro, mais programações</span></div>
            <div class="card-body">${renderPiauiHeatMap()}</div></div>
          <div class="card"><div class="card-header"><h3>Detalhe do município</h3></div>
            <div class="card-body" id="bi-mun-detail"><p class="text-muted">Clique em um município no mapa.</p></div></div>
        </div>
      </div>

      <div class="tab-content" data-tab-content="reg">
        <div class="card"><div class="card-body table-compact"><div class="table-wrapper"><table>
          <thead><tr><th>Regional</th><th>Programações</th><th>Municípios</th><th>Coordenações</th></tr></thead>
          <tbody>${porRegional.map((r) => `<tr><td>${r.nome}</td><td>${r.programacoes}</td><td>${r.municipios}</td><td>${r.coordenacoes}</td></tr>`).join('')
            || '<tr><td colspan="4" class="text-muted">Sem dados.</td></tr>'}</tbody>
        </table></div></div></div>
      </div>

      <div class="tab-content" data-tab-content="mensal">
        <div class="card chart-card"><div class="card-header"><h3>Linha do tempo — ${anoAtual}</h3></div>
          <div class="card-body">${renderBarChart(porMes)}</div></div>
      </div>

      <div class="tab-content" data-tab-content="tipo">
        <div class="card chart-card"><div class="card-header"><h3>BI por Tipo de Ação</h3></div>
          <div class="card-body">${renderDonutChart(porTipo.length ? porTipo : [{ label: 'Sem dados', value: 1, color: '#CED4DA' }])}</div></div>
      </div>

      <div class="tab-content" data-tab-content="publico">
        <div class="card chart-card"><div class="card-header"><h3>BI Público-Alvo</h3></div>
          <div class="card-body">${renderDonutChart(porPublico.length ? porPublico : [{ label: 'Sem dados', value: 1, color: '#CED4DA' }])}</div></div>
      </div>

      <div class="tab-content" data-tab-content="log">
        <div class="kpi-grid-3 mb-3">
          <div class="kpi-card kpi-simple"><strong>${transporte.length}</strong><span>Solicitaram transporte</span></div>
          <div class="kpi-card kpi-simple"><strong>${alimentacao.length}</strong><span>Solicitaram alimentação</span></div>
          <div class="kpi-card kpi-simple"><strong>${programacoes.filter((p) => p.necessitaTransporte && p.necessitaAlimentacao).length}</strong><span>Transporte + alimentação</span></div>
        </div>
        <div class="charts-row-2">
          <div class="card chart-card"><div class="card-header"><h3>Transporte por mês</h3></div>
            <div class="card-body">${renderBarChart(porMes.map((m) => ({ ...m, value: transporte.filter((p) => {
              const d = new Date(p.dataInicial + 'T12:00:00');
              return d.getFullYear() === anoAtual && ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()] === m.label;
            }).length })))}</div></div>
          <div class="card chart-card"><div class="card-header"><h3>Transporte por gerência</h3></div>
            <div class="card-body">${renderHorizontalBarChart(countByGerencia(transporte))}</div></div>
        </div>
      </div>

      <div class="tab-content" data-tab-content="status">
        <div class="card chart-card"><div class="card-header"><h3>BI de Status</h3></div>
          <div class="card-body">${renderDonutChart(porStatus.length ? porStatus.map((s) => ({ label: s.label, value: s.value, color: s.color })) : [{ label: 'Sem dados', value: 1, color: '#CED4DA' }])}</div></div>
      </div>

      <div class="tab-content" data-tab-content="cal">
        <div class="card"><div class="card-header"><h3>Calendário de concentração de atividades</h3>
          <span class="text-sm text-muted">Dias com mais ações em vermelho escuro — evite conflitos de agenda</span></div>
          <div class="card-body">${renderCalHeat(dayCounts, anoAtual, mesAtual)}</div></div>
      </div>
    </div>`;
}

function renderCalHeat(dayCounts, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const max = Math.max(...[...dayCounts.values()], 1);
  let html = '<div class="mini-cal-grid bi-cal-heat">';
  ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((h) => { html += `<span class="mini-cal-head">${h}</span>`; });
  for (let i = 0; i < firstDay; i++) html += '<span class="mini-cal-day empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const n = dayCounts.get(ds) || 0;
    const intensity = n === 0 ? 0 : Math.ceil((n / max) * 4);
    html += `<span class="mini-cal-day bi-heat-${intensity}" title="${n} atividade(s)">${d}${n ? `<small>${n}</small>` : ''}</span>`;
  }
  html += '</div>';
  return html;
}

export function bindBiGerencial() {
  document.getElementById('btn-download-bi')?.addEventListener('click', () => downloadBiReportPdf());

  const tabs = document.getElementById('bi-tabs');
  if (tabs) bindTabs(tabs.parentElement);

  bindPiauiHeatMap((munId, munName) => {
    const stats = municipioStats(getProgramacoesForBI(getProgramacoes()), munId);
    const el = document.getElementById('bi-mun-detail');
    if (!el) return;
    el.innerHTML = `
      <h3>${munName}</h3>
      <div class="detail-grid mt-2">
        <div class="detail-item"><label>Programações</label><span>${stats.programacoes}</span></div>
        <div class="detail-item"><label>Coordenações</label><span>${stats.coordenacoes}</span></div>
        <div class="detail-item"><label>Servidores</label><span>${stats.servidores}</span></div>
        <div class="detail-item"><label>Dias de atividades</label><span>${stats.dias}</span></div>
      </div>
      <a href="#municipios/${munId}" class="btn btn-outline btn-sm mt-2">Ver município</a>`;
  });
}
