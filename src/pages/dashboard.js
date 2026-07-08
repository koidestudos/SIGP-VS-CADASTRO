import { getProgramacoes } from '../services/programacoes-service.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, COORDENACOES, GERENCIAS,
} from '../data/seed.js';
import { renderDonutChart, renderBarChart } from '../components/charts.js';
import { renderPiauiMap, bindPiauiMap } from '../components/piaui-map.js';

export function renderDashboard(user) {
  const programacoes = getProgramacoes();
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const doMes = programacoes.filter((p) => {
    const d = new Date(p.dataInicial + 'T12:00:00');
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const proximas = programacoes
    .filter((p) => new Date(p.dataInicial) >= now && !['Cancelada', 'Concluída'].includes(p.status))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
    .slice(0, 8);

  const porGerencia = GERENCIAS.map((g, i) => {
    const colors = ['#1351B4', '#168821', '#ca8a04'];
    return { label: g, value: doMes.filter((p) => getGerenciaByProgramacao(p) === g).length, color: colors[i] };
  });

  const porSemana = ['1ª Sem', '2ª Sem', '3ª Sem', '4ª Sem'].map((label, i) => ({
    label,
    value: doMes.filter((p) => (p.semana || '').includes(`${i + 1}ª`)).length,
  }));

  const porStatus = [
    { label: 'Confirmada', value: programacoes.filter((p) => ['Publicada', 'Aprovada'].includes(p.status)).length, color: '#168821' },
    { label: 'Em andamento', value: programacoes.filter((p) => p.status === 'Pendente').length, color: '#ca8a04' },
    { label: 'Programada', value: programacoes.filter((p) => p.status === 'Rascunho').length, color: '#1351B4' },
    { label: 'Concluída', value: programacoes.filter((p) => p.status === 'Concluída').length, color: '#6C757D' },
  ].filter((s) => s.value > 0);

  const primeiroNome = user.nome.split(' ')[0];

  return `
    <div class="admin-dashboard">
      <div class="dash-header">
        <div>
          <h2 class="dash-greeting">Olá, ${primeiroNome}!</h2>
          <p class="dash-subtitle">Visão geral das programações da Vigilância em Saúde</p>
        </div>
        <div class="dash-header-actions">
          <input type="month" class="form-control dash-month-picker" id="dash-mes" value="${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}" />
          <button class="btn btn-outline btn-sm" id="dash-filtros">Filtrar</button>
        </div>
      </div>

      <div class="kpi-grid-6">
        <div class="kpi-card"><div class="kpi-icon blue">📋</div><div><strong>${doMes.length}</strong><span>Ações cadastradas no mês</span></div></div>
        <div class="kpi-card"><div class="kpi-icon green">🏢</div><div><strong>${new Set(doMes.map((p) => p.coordenacaoId)).size}</strong><span>Coordenações participantes</span></div></div>
        <div class="kpi-card"><div class="kpi-icon teal">📍</div><div><strong>${new Set(doMes.map((p) => p.municipioId)).size}</strong><span>Municípios envolvidos</span></div></div>
        <div class="kpi-card"><div class="kpi-icon orange">⏳</div><div><strong>${programacoes.filter((p) => p.status === 'Pendente').length}</strong><span>Ações em andamento</span></div></div>
        <div class="kpi-card"><div class="kpi-icon purple">🚗</div><div><strong>${programacoes.filter((p) => p.necessitaTransporte).length}</strong><span>Viagens previstas</span></div></div>
        <div class="kpi-card"><div class="kpi-icon gold">✅</div><div><strong>${programacoes.filter((p) => p.status === 'Publicada').length}</strong><span>Ações confirmadas</span></div></div>
      </div>

      <div class="charts-row-3">
        <div class="card chart-card"><div class="card-header"><h3>Programações por Gerência</h3></div><div class="card-body">${renderDonutChart(porGerencia.filter((g) => g.value > 0).length ? porGerencia : [{ label: 'GAS', value: 1, color: '#1351B4' }])}</div></div>
        <div class="card chart-card"><div class="card-header"><h3>Programações por Semana</h3></div><div class="card-body">${renderBarChart(porSemana)}</div></div>
        <div class="card chart-card"><div class="card-header"><h3>Mapa de Programações</h3></div><div class="card-body">${renderPiauiMap()}</div></div>
      </div>

      <div class="charts-row-2">
        <div class="card">
          <div class="card-header"><h3>Próximas Programações</h3></div>
          <div class="card-body table-compact">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr><th>Ação</th><th>Gerência</th><th>Coordenação</th><th>Município</th><th>Data Ida</th><th>Data Volta</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${proximas.length ? proximas.map((p) => {
                    const coord = getCoordenacaoById(p.coordenacaoId);
                    const mun = getMunicipioById(p.municipioId);
                    return `<tr>
                      <td class="td-action">${p.titulo}</td>
                      <td><span class="gerencia-tag gerencia-${getGerenciaByProgramacao(p).toLowerCase()}">${getGerenciaByProgramacao(p)}</span></td>
                      <td>${coord?.sigla || '—'}</td>
                      <td>${mun?.nome || '—'}</td>
                      <td>${formatDate(p.dataInicial)}</td>
                      <td>${formatDate(p.dataFinal)}</td>
                      <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
                    </tr>`;
                  }).join('') : '<tr><td colspan="7" class="text-center text-muted">Nenhuma programação futura.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card chart-card"><div class="card-header"><h3>Ações por Status</h3></div><div class="card-body">${renderDonutChart(porStatus.length ? porStatus : [{ label: 'Sem dados', value: 1, color: '#CED4DA' }])}</div></div>
      </div>
    </div>
  `;
}

export function bindDashboard() {
  bindPiauiMap();
  document.getElementById('dash-filtros')?.addEventListener('click', () => {
    window.location.hash = 'programacoes';
  });
}
