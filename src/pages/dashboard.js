import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass } from '../data/seed.js';

export function renderDashboard(user) {
  const programacoes = getCollection('programacoes');
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const doMes = programacoes.filter((p) => {
    const d = new Date(p.dataInicial + 'T12:00:00');
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const municipiosAtendidos = new Set(doMes.map((p) => p.municipioId)).size;
  const coordenacoesParticipantes = new Set(doMes.map((p) => p.coordenacaoId)).size;
  const solicitacoesTransporte = getCollection('logistica').filter((l) => l.transporte && l.situacao === 'Solicitado').length;

  const ultimas = [...programacoes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);
  const proximas = programacoes
    .filter((p) => new Date(p.dataInicial) >= now && !['Cancelada', 'Concluída'].includes(p.status))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
    .slice(0, 5);

  const calHtml = renderMiniCalendar(programacoes, mesAtual, anoAtual);

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">📅</div>
        <div class="stat-info"><h3>${doMes.length}</h3><p>Programações do mês</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">📍</div>
        <div class="stat-info"><h3>${municipiosAtendidos}</h3><p>Municípios atendidos</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">👥</div>
        <div class="stat-info"><h3>${coordenacoesParticipantes}</h3><p>Coordenações participantes</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">🚗</div>
        <div class="stat-info"><h3>${solicitacoesTransporte}</h3><p>Solicitações de transporte</p></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>Calendário do mês</h3></div>
        <div class="card-body">${calHtml}</div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Próximas ações</h3></div>
        <div class="card-body">
          ${proximas.length ? `
            <div class="table-wrapper">
              <table>
                <thead><tr><th>Ação</th><th>Data</th><th>Status</th></tr></thead>
                <tbody>
                  ${proximas.map((p) => `
                    <tr>
                      <td>${p.titulo}</td>
                      <td>${formatDate(p.dataInicial)}</td>
                      <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p class="text-muted text-center">Nenhuma ação programada.</p>'}
        </div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header"><h3>Últimas programações cadastradas</h3></div>
      <div class="card-body">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Ação</th><th>Coordenação</th><th>Município</th><th>Data</th><th>Responsável</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${ultimas.map((p) => {
                const coord = getCoordenacaoById(p.coordenacaoId);
                const mun = getMunicipioById(p.municipioId);
                return `
                  <tr>
                    <td>${p.titulo}</td>
                    <td>${coord?.sigla || '—'}</td>
                    <td>${mun?.nome || '—'}</td>
                    <td>${formatDate(p.dataInicial)}</td>
                    <td>${p.responsavel}</td>
                    <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderMiniCalendar(programacoes, month, year) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date().getDate();
  const eventDays = new Set();

  programacoes.forEach((p) => {
    const d = new Date(p.dataInicial + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      eventDays.add(d.getDate());
    }
  });

  const headers = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let html = headers.map((h) => `<div class="mini-cal-header">${h}</div>`).join('');

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const cls = [
      'mini-cal-day',
      d === today && month === new Date().getMonth() ? 'today' : '',
      eventDays.has(d) ? 'has-event' : '',
    ].filter(Boolean).join(' ');
    html += `<div class="${cls}">${d}</div>`;
  }

  return `<div class="mini-calendar">${html}</div>`;
}
