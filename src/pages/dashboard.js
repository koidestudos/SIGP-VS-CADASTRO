import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass, COORDENACOES } from '../data/seed.js';
import { isAdmin } from '../services/storage.js';
import { renderDonutChart, renderBarChart, renderMapPlaceholder } from '../components/charts.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function renderDashboard(user) {
  if (isAdmin(user)) {
    return renderAdminDashboard(user);
  }
  return renderCadastroDashboard(user);
}

function filterByMonth(programacoes, month, year) {
  return programacoes.filter((p) => {
    const d = new Date(p.dataInicial + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

function renderAdminDashboard(user) {
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();
  const programacoes = getCollection('programacoes');
  const doMes = filterByMonth(programacoes, mesAtual, anoAtual);
  const logistica = getCollection('logistica');
  const municipios = getCollection('municipios');

  const emAndamento = programacoes.filter((p) => ['Aprovada', 'Publicada', 'Pendente'].includes(p.status)).length;
  const viagensSemana = logistica.filter((l) => l.transporte).length;
  const recursos = doMes.reduce((s, p) => s + (p.codigoOrcamentario ? 125000 : 45000), 0);

  const proximas = programacoes
    .filter((p) => new Date(p.dataInicial) >= now && !['Cancelada', 'Concluída'].includes(p.status))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
    .slice(0, 6);

  const porGerencia = ['GAS', 'GAP', 'GVS', 'DUVAS'].map((g, i) => {
    const colors = ['#1351B4', '#168821', '#FF9900', '#6f42c1'];
    const count = g === 'DUVAS'
      ? doMes.length
      : doMes.filter((p) => getCoordenacaoById(p.coordenacaoId)?.gerencia === g).length;
    return { label: g, value: count || (g === 'GAS' ? 2 : 1), color: colors[i] };
  });

  const porSemana = ['1ª Sem', '2ª Sem', '3ª Sem', '4ª Sem'].map((label, i) => ({
    label,
    value: doMes.filter((p) => (p.semana || '').includes(`${i + 1}ª`)).length || Math.max(1, Math.floor(doMes.length / 4)),
  }));

  const porStatus = [
    { label: 'Confirmada', value: programacoes.filter((p) => p.status === 'Publicada' || p.status === 'Aprovada').length, color: '#168821' },
    { label: 'Em andamento', value: programacoes.filter((p) => p.status === 'Pendente').length, color: '#FF9900' },
    { label: 'Programada', value: programacoes.filter((p) => p.status === 'Rascunho').length, color: '#1351B4' },
    { label: 'Concluída', value: programacoes.filter((p) => p.status === 'Concluída').length, color: '#6C757D' },
  ].filter((s) => s.value > 0);

  const munsAtivos = [...new Set(doMes.map((p) => p.municipioId))].map((id) => getMunicipioById(id)).filter(Boolean);
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
          <button class="btn btn-outline btn-sm" id="dash-filtros">Filtros</button>
        </div>
      </div>

      <div class="kpi-grid-6">
        <div class="kpi-card">
          <div class="kpi-icon blue">📋</div>
          <div><strong>${doMes.length || programacoes.length}</strong><span>Ações cadastradas no mês</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon green">🏢</div>
          <div><strong>${new Set(doMes.map((p) => p.coordenacaoId)).size || COORDENACOES.length}</strong><span>Coordenações participantes</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon teal">📍</div>
          <div><strong>${new Set(doMes.map((p) => p.municipioId)).size || municipios.length}</strong><span>Municípios envolvidos</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon orange">⏳</div>
          <div><strong>${emAndamento}</strong><span>Ações em andamento</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon purple">🚗</div>
          <div><strong>${viagensSemana}</strong><span>Viagens previstas esta semana</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon gold">💰</div>
          <div><strong>${formatRecursos(recursos)}</strong><span>Recursos previstos no mês</span></div>
        </div>
      </div>

      <div class="charts-row-3">
        <div class="card chart-card">
          <div class="card-header"><h3>Programações por Coordenação</h3></div>
          <div class="card-body">${renderDonutChart(porGerencia)}</div>
        </div>
        <div class="card chart-card">
          <div class="card-header"><h3>Programações por Semana</h3></div>
          <div class="card-body">${renderBarChart(porSemana)}</div>
        </div>
        <div class="card chart-card">
          <div class="card-header"><h3>Mapa de Programações</h3></div>
          <div class="card-body">${renderMapPlaceholder(munsAtivos.length ? munsAtivos : municipios.slice(0, 6))}</div>
        </div>
      </div>

      <div class="charts-row-2">
        <div class="card">
          <div class="card-header"><h3>Próximas Programações</h3></div>
          <div class="card-body table-compact">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr><th>Ação</th><th>Coordenação</th><th>Município</th><th>Período</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${proximas.length ? proximas.map((p) => {
                    const coord = getCoordenacaoById(p.coordenacaoId);
                    const mun = getMunicipioById(p.municipioId);
                    return `
                      <tr>
                        <td class="td-action">${p.titulo}</td>
                        <td>${coord?.sigla || '—'}</td>
                        <td>${mun?.nome || '—'}</td>
                        <td>${formatDate(p.dataInicial)} — ${formatDate(p.dataFinal)}</td>
                        <td><span class="badge ${getStatusBadgeClass(p.status)}">${mapStatusLabel(p.status)}</span></td>
                      </tr>
                    `;
                  }).join('') : '<tr><td colspan="5" class="text-center text-muted">Nenhuma programação futura.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card chart-card">
          <div class="card-header"><h3>Ações por Status</h3></div>
          <div class="card-body">${renderDonutChart(porStatus.length ? porStatus : [{ label: 'Sem dados', value: 1, color: '#CED4DA' }])}</div>
        </div>
      </div>
    </div>
  `;
}

function renderCadastroDashboard(user) {
  const programacoes = getCollection('programacoes');
  const coordFilter = user.coordenacaoId
    ? programacoes.filter((p) => p.coordenacaoId === user.coordenacaoId)
    : programacoes;

  const pendentes = coordFilter.filter((p) => p.status === 'Rascunho' || p.status === 'Pendente').length;
  const publicadas = coordFilter.filter((p) => p.status === 'Publicada' || p.status === 'Aprovada').length;
  const proximas = coordFilter
    .filter((p) => !['Cancelada', 'Concluída'].includes(p.status))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
    .slice(0, 5);

  const primeiroNome = user.nome.split(' ')[0];

  return `
    <div class="cadastro-dashboard">
      <div class="dash-header">
        <div>
          <h2 class="dash-greeting">Olá, ${primeiroNome}!</h2>
          <p class="dash-subtitle">Cadastre e acompanhe as programações da sua coordenação</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='nova-programacao'">➕ Nova Programação</button>
      </div>

      <div class="kpi-grid-3">
        <div class="kpi-card kpi-simple">
          <strong>${coordFilter.length}</strong>
          <span>Suas programações</span>
        </div>
        <div class="kpi-card kpi-simple">
          <strong>${pendentes}</strong>
          <span>Pendentes / rascunhos</span>
        </div>
        <div class="kpi-card kpi-simple">
          <strong>${publicadas}</strong>
          <span>Publicadas</span>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-header flex-between">
          <h3>Suas programações recentes</h3>
          <a href="#programacoes" class="btn btn-ghost btn-sm">Ver todas →</a>
        </div>
        <div class="card-body">
          ${proximas.length ? `
            <div class="table-wrapper">
              <table>
                <thead><tr><th>Ação</th><th>Município</th><th>Data</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  ${proximas.map((p) => {
                    const mun = getMunicipioById(p.municipioId);
                    return `
                      <tr>
                        <td>${p.titulo}</td>
                        <td>${mun?.nome || '—'}</td>
                        <td>${formatDate(p.dataInicial)}</td>
                        <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
                        <td><button class="btn btn-outline btn-sm" onclick="window.location.hash='nova-programacao/edit/${p.id}'">Editar</button></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">📅</div>
              <h3>Nenhuma programação cadastrada</h3>
              <p>Comece criando uma nova programação.</p>
              <button class="btn btn-primary mt-2" onclick="window.location.hash='nova-programacao'">Nova Programação</button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function formatRecursos(val) {
  if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (val >= 1000) return `R$ ${Math.round(val / 1000)} mil`;
  return `R$ ${val}`;
}

function mapStatusLabel(status) {
  const map = {
    Publicada: 'Confirmada',
    Aprovada: 'Confirmada',
    Pendente: 'Em andamento',
    Rascunho: 'Programada',
    Concluída: 'Concluída',
  };
  return map[status] || status;
}

export function bindDashboard(user) {
  document.getElementById('dash-filtros')?.addEventListener('click', () => {
    window.location.hash = 'programacoes';
  });
}
