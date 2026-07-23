import { getProgramacoes } from '../services/programacoes-service.js';
import {
  getCoordenacaoById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, getMunicipiosLabel,
} from '../data/seed.js';
import { proximasAcoes } from '../utils/bi-metrics.js';
import { countByStatusGroup, filterForDashboard, normalizeStatus, getStatusRowClass } from '../utils/status.js';
import { currentWeekRangeBR, programacaoNaSemana, todayBR, todayPartsBR } from '../utils/datetime-br.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function renderMiniCalendar(programacoes, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const { day: todayDay, month: todayMonth, year: todayYear } = todayPartsBR();
  const countOn = (d) => programacoes.filter((p) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return ds >= p.dataInicial && ds <= (p.dataFinal || p.dataInicial);
  }).length;

  let html = '<div class="mini-cal-grid">';
  ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((h) => { html += `<span class="mini-cal-head">${h}</span>`; });
  for (let i = 0; i < firstDay; i++) html += '<span class="mini-cal-day empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const n = countOn(d);
    const isToday = todayDay === d && todayMonth === month + 1 && todayYear === year;
    const heat = n === 0 ? '' : n <= 2 ? 'heat-1' : n <= 5 ? 'heat-2' : 'heat-3';
    html += `<span class="mini-cal-day ${isToday ? 'today' : ''} ${heat}" title="${n} ação(ões)">${d}</span>`;
  }
  html += '</div>';
  return html;
}

function renderAcaoList(items, emptyMsg) {
  if (!items.length) return `<p class="text-muted text-sm">${emptyMsg}</p>`;
  return `<ul class="dash-action-list">${items.slice(0, 5).map((p) => `
    <li>
      <strong>${p.titulo}</strong>
      <span>${getMunicipiosLabel(p)} · Ida ${formatDate(p.dataInicial)} · Volta ${formatDate(p.dataFinal)} · ${normalizeStatus(p.status)}</span>
    </li>`).join('')}</ul>`;
}

export function renderDashboard(user) {
  const todas = getProgramacoes();
  const programacoes = filterForDashboard(todas);
  const counts = countByStatusGroup(todas);
  const programadas = counts.Programada || 0;
  const priorizadas = counts.Priorizada || 0;
  const autorizadas = (counts.Autorizada || 0) + (counts['Em execução'] || 0);
  const realizadas = counts.Realizada || 0;

  const hojeBR = todayBR();
  const { year: anoAtual, month: mesNum } = todayPartsBR();
  const mesAtual = mesNum - 1;
  const semanaAtual = currentWeekRangeBR();

  const daSemana = programacoes
    .filter((p) => programacaoNaSemana(p, semanaAtual.start, semanaAtual.end))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial));

  const proximas = programacoes
    .filter((p) => {
      const status = normalizeStatus(p.status);
      if (['Realizada', 'Cancelada', 'Reprovada'].includes(status)) return false;
      const fim = p.dataFinal || p.dataInicial;
      return fim >= hojeBR;
    })
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial))
    .slice(0, 10);

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
          <p class="dash-subtitle">Acompanhe programações programadas, priorizadas, autorizadas e realizadas</p>
        </div>
        <button class="btn btn-primary btn-lg" id="dash-nova">+ Nova Programação</button>
      </div>

      <div class="dash-kpi-row">
        <div class="dash-kpi-card dash-kpi-blue">
          <span class="dash-kpi-icon">📅</span>
          <div>
            <strong>${programadas}</strong>
            <span>Programadas</span>
          </div>
        </div>
        <div class="dash-kpi-card dash-kpi-blue">
          <span class="dash-kpi-icon">⚡</span>
          <div>
            <strong>${priorizadas}</strong>
            <span>Priorizadas</span>
          </div>
        </div>
        <div class="dash-kpi-card dash-kpi-blue">
          <span class="dash-kpi-icon">📊</span>
          <div>
            <strong>${autorizadas}</strong>
            <span>Autorizadas</span>
          </div>
        </div>
        <div class="dash-kpi-card dash-kpi-green">
          <span class="dash-kpi-icon">✅</span>
          <div>
            <strong>${realizadas}</strong>
            <span>Realizadas</span>
          </div>
        </div>
      </div>
      <p class="text-sm text-muted mb-3">Rascunhos, enviadas, canceladas e reprovadas ficam em <a href="#programacoes">Programações</a>.</p>

      <div class="card mb-3">
        <div class="card-header">
          <h3>📋 Programações da semana</h3>
          <span class="badge badge-programada">${daSemana.length}</span>
        </div>
        <p class="text-sm text-muted" style="padding:0 16px;margin:0">Semana atual (Brasília): ${semanaAtual.label}</p>
        <div class="card-body table-compact">
          ${daSemana.length ? `<div class="table-wrapper"><table>
            <thead><tr><th>Ação</th><th>Município</th><th>Gerência</th><th>Data Ida</th><th>Data Volta</th><th>Status</th></tr></thead>
            <tbody>${daSemana.map((p) => `
              <tr class="${normalizeStatus(p.status) ? '' : ''}">
                <td class="td-action">${p.titulo}</td>
                <td>${getMunicipiosLabel(p)}</td>
                <td><span class="gerencia-tag gerencia-${getGerenciaByProgramacao(p).toLowerCase()}">${getGerenciaByProgramacao(p)}</span></td>
                <td>${formatDate(p.dataInicial)}</td>
                <td>${formatDate(p.dataFinal)}</td>
                <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="text-muted">Nenhuma programação nesta semana.</p>'}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h3>⏭ Próximas programações</h3>
          <a href="#programacoes" class="btn btn-ghost btn-sm">Ver todas</a>
        </div>
        <div class="card-body table-compact">
          ${proximas.length ? `<div class="table-wrapper"><table>
            <thead><tr><th>Ação</th><th>Município</th><th>Data Ida</th><th>Data Volta</th><th>Status</th></tr></thead>
            <tbody>${proximas.map((p) => `
              <tr>
                <td class="td-action">${p.titulo}</td>
                <td>${getMunicipiosLabel(p)}</td>
                <td>${formatDate(p.dataInicial)}</td>
                <td>${formatDate(p.dataFinal)}</td>
                <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="text-muted">Nenhuma programação futura (Programada, Priorizada, Autorizada ou Em execução).</p>'}
        </div>
      </div>

      <div class="dash-quick-grid">
        <div class="card">
          <div class="card-header"><h3>⏱ Agenda rápida</h3></div>
          <div class="card-body">
            <div class="proximas-tabs">
              <div class="proximas-block"><h4>Hoje</h4>${renderAcaoList(hoje, 'Nada para hoje.')}</div>
              <div class="proximas-block"><h4>Amanhã</h4>${renderAcaoList(amanha, 'Nada para amanhã.')}</div>
              <div class="proximas-block"><h4>Próxima semana</h4>${renderAcaoList(semana, 'Nada na próxima semana.')}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>📆 Calendário — ${MESES[mesAtual]}/${anoAtual}</h3>
            <a href="#calendario" class="btn btn-ghost btn-sm">Abrir calendário</a></div>
          <div class="card-body">${renderMiniCalendar(programacoes, anoAtual, mesAtual)}</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3>🕐 Últimas atualizações</h3></div>
        <div class="card-body table-compact">
          ${ultimas.length ? `<div class="table-wrapper"><table>
            <thead><tr><th>Ação</th><th>Coordenação</th><th>Status</th></tr></thead>
            <tbody>${ultimas.map((p) => {
              const coord = getCoordenacaoById(p.coordenacaoId);
              return `<tr>
                <td class="td-action">${p.titulo}</td>
                <td>${coord?.nome || '—'}</td>
                <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>` : '<p class="text-muted">Nenhuma programação ainda.</p>'}
        </div>
      </div>
    </div>`;
}

export function bindDashboard() {
  document.getElementById('dash-nova')?.addEventListener('click', () => {
    window.location.hash = 'nova-programacao';
  });
}
