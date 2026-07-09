import { getProgramacoes } from '../services/programacoes-service.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao,
} from '../data/seed.js';
import { proximasAcoes } from '../utils/bi-metrics.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function renderMiniCalendar(programacoes, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  const countOn = (d) => programacoes.filter((p) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return ds >= p.dataInicial && ds <= (p.dataFinal || p.dataInicial);
  }).length;

  let html = '<div class="mini-cal-grid">';
  ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((h) => { html += `<span class="mini-cal-head">${h}</span>`; });
  for (let i = 0; i < firstDay; i++) html += '<span class="mini-cal-day empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const n = countOn(d);
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    const heat = n === 0 ? '' : n <= 2 ? 'heat-1' : n <= 5 ? 'heat-2' : 'heat-3';
    html += `<span class="mini-cal-day ${isToday ? 'today' : ''} ${heat}" title="${n} ação(ões)">${d}</span>`;
  }
  html += '</div>';
  return html;
}

function renderAcaoList(items, emptyMsg) {
  if (!items.length) return `<p class="text-muted text-sm">${emptyMsg}</p>`;
  return `<ul class="dash-action-list">${items.slice(0, 5).map((p) => {
    const mun = getMunicipioById(p.municipioId);
    return `<li>
      <strong>${p.titulo}</strong>
      <span>${mun?.nome || '—'} · ${formatDate(p.dataInicial)}</span>
    </li>`;
  }).join('')}</ul>`;
}

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
    .filter((p) => new Date(p.dataInicial) >= now && !['Cancelada', 'Rascunho'].includes(p.status))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
    .slice(0, 6);

  const ultimas = [...programacoes]
    .sort((a, b) => (b.atualizadoEm || b.criadoEm || '').localeCompare(a.atualizadoEm || a.criadoEm || ''))
    .slice(0, 6);

  const { hoje, amanha, semana } = proximasAcoes(programacoes);
  const primeiroNome = (user.nome || 'Servidor').split(' ')[0];

  return `
    <div class="operational-dashboard">
      <div class="dash-header">
        <div>
          <h2 class="dash-greeting">Olá, ${primeiroNome}!</h2>
          <p class="dash-subtitle">Cadastre e acompanhe suas programações de forma rápida</p>
        </div>
        <button class="btn btn-primary btn-lg" id="dash-nova">+ Nova Programação</button>
      </div>

      <div class="dash-quick-grid">
        <div class="card">
          <div class="card-header"><h3>📋 Programações do mês</h3><span class="badge badge-programada">${doMes.length}</span></div>
          <div class="card-body table-compact">
            ${doMes.length ? `<div class="table-wrapper"><table>
              <thead><tr><th>Ação</th><th>Gerência</th><th>Data</th><th>Status</th></tr></thead>
              <tbody>${doMes.slice(0, 8).map((p) => `
                <tr>
                  <td class="td-action">${p.titulo}</td>
                  <td><span class="gerencia-tag gerencia-${getGerenciaByProgramacao(p).toLowerCase()}">${getGerenciaByProgramacao(p)}</span></td>
                  <td>${formatDate(p.dataInicial)}</td>
                  <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
                </tr>`).join('')}</tbody>
            </table></div>` : '<p class="text-muted">Nenhuma programação neste mês.</p>'}
            ${doMes.length > 8 ? `<a href="#programacoes" class="dash-link">Ver todas →</a>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>⏭ Próximas ações</h3></div>
          <div class="card-body">
            <div class="proximas-tabs">
              <div class="proximas-block"><h4>Hoje</h4>${renderAcaoList(hoje, 'Nada para hoje.')}</div>
              <div class="proximas-block"><h4>Amanhã</h4>${renderAcaoList(amanha, 'Nada para amanhã.')}</div>
              <div class="proximas-block"><h4>Próxima semana</h4>${renderAcaoList(semana, 'Nada na próxima semana.')}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-quick-grid">
        <div class="card">
          <div class="card-header"><h3>📆 Calendário — ${MESES[mesAtual]}/${anoAtual}</h3>
            <a href="#calendario" class="btn btn-ghost btn-sm">Abrir calendário</a></div>
          <div class="card-body">${renderMiniCalendar(programacoes, anoAtual, mesAtual)}</div>
        </div>

        <div class="card">
          <div class="card-header"><h3>🕐 Últimas programações cadastradas</h3></div>
          <div class="card-body table-compact">
            ${ultimas.length ? `<div class="table-wrapper"><table>
              <thead><tr><th>Ação</th><th>Coordenação</th><th>Status</th></tr></thead>
              <tbody>${ultimas.map((p) => {
                const coord = getCoordenacaoById(p.coordenacaoId);
                return `<tr>
                  <td class="td-action">${p.titulo}</td>
                  <td>${coord?.nome || '—'}</td>
                  <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>` : '<p class="text-muted">Nenhuma programação cadastrada.</p>'}
          </div>
        </div>
      </div>

      ${proximas.length ? `
      <div class="card mt-3">
        <div class="card-header"><h3>Próximas programações</h3></div>
        <div class="card-body table-compact">
          <div class="table-wrapper"><table>
            <thead><tr><th>Ação</th><th>Município</th><th>Data Ida</th><th>Status</th></tr></thead>
            <tbody>${proximas.map((p) => {
              const mun = getMunicipioById(p.municipioId);
              return `<tr>
                <td class="td-action">${p.titulo}</td>
                <td>${mun?.nome || '—'}</td>
                <td>${formatDate(p.dataInicial)}</td>
                <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>
        </div>
      </div>` : ''}
    </div>`;
}

export function bindDashboard() {
  document.getElementById('dash-nova')?.addEventListener('click', () => {
    window.location.hash = 'nova-programacao';
  });
}
