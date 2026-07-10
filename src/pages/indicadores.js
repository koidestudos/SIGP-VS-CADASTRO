import { getProgramacoes } from '../services/programacoes-service.js';
import {
  getCoordenacaoById, getMunicipioById, getGerenciaByProgramacao,
  GERENCIAS, COORDENACOES, formatDate,
} from '../data/seed.js';
import { renderDonutChart, renderBarChart } from '../components/charts.js';
import { getProgramacoesForBI } from '../utils/bi-metrics.js';
import { countByStatusGroup, needsApproval } from '../utils/status.js';

export function renderIndicadores() {
  const todas = getProgramacoes();
  const programacoes = getProgramacoesForBI(todas);
  const counts = countByStatusGroup(todas);
  const now = new Date();
  const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const doMes = programacoes.filter((p) => p.dataInicial?.startsWith(mes));

  const porGerencia = GERENCIAS.map((g, i) => ({
    label: g,
    value: doMes.filter((p) => getGerenciaByProgramacao(p) === g).length,
    color: ['#1351B4', '#168821', '#ca8a04'][i],
  }));

  const porCoord = COORDENACOES.map((c) => ({
    label: c.sigla,
    value: doMes.filter((p) => p.coordenacaoId === c.id).length,
  })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);

  const aguardando = counts.Programada + counts['Enviada para Gerência'];
  const autorizadas = counts.Autorizada + counts['Em execução'];
  const taxaRealizacao = autorizadas + counts.Realizada
    ? Math.round((counts.Realizada / (autorizadas + counts.Realizada)) * 100)
    : 0;

  return `
    <div class="page-header"><h2>Indicadores</h2></div>

    <div class="kpi-grid-3 mb-3">
      <div class="kpi-card kpi-simple"><strong>${doMes.length}</strong><span>Ações no mês (BI)</span></div>
      <div class="kpi-card kpi-simple"><strong>${aguardando}</strong><span>Programadas / aguardando gerência</span></div>
      <div class="kpi-card kpi-simple"><strong>${taxaRealizacao}%</strong><span>Taxa de realização</span></div>
    </div>

    <div class="grid-2">
      <div class="card chart-card">
        <div class="card-header"><h3>Ações por Gerência (mês atual)</h3></div>
        <div class="card-body">${renderDonutChart(porGerencia.filter((g) => g.value > 0).length ? porGerencia : [{ label: '—', value: 1, color: '#CED4DA' }])}</div>
      </div>
      <div class="card chart-card">
        <div class="card-header"><h3>Top Coordenações</h3></div>
        <div class="card-body">${renderBarChart(porCoord.length ? porCoord : [{ label: '—', value: 0 }])}</div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header"><h3>Indicadores por status (todas as programações)</h3></div>
      <div class="card-body">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Status</th><th>Quantidade</th><th>% do total</th><th>Entra no BI?</th></tr></thead>
            <tbody>
              ${Object.entries(counts).map(([s, q]) => {
                const pct = todas.length ? Math.round((q / todas.length) * 100) : 0;
                const inBi = ['Autorizada', 'Em execução', 'Realizada'].includes(s);
                return `<tr><td>${s}</td><td>${q}</td><td>${pct}%</td><td>${inBi ? '✅ Sim' : '❌ Não'}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function bindIndicadores() {}
