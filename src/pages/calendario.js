import { getProgramacoes } from '../services/programacoes-service.js';
import {
  COORDENACOES, getCoordenacaoById, getMunicipioById, getGerenciaByProgramacao,
  getGerenciaColor, shortTitle, formatDate, GERENCIAS,
} from '../data/seed.js';
import { showModal } from '../components/ui.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

let calState = { view: 'mes', year: new Date().getFullYear(), month: new Date().getMonth() };

export function renderCalendario() {
  return `
    <div class="cal-page">
      <div class="cal-page-header">
        <div class="cal-view-bar">
          <span class="cal-view-label">Visualização:</span>
          <div class="view-toggle view-toggle-lg">
            <button data-view="dia">Dia</button>
            <button data-view="semana">Semana</button>
            <button data-view="mes" class="active">Mês</button>
            <button data-view="ano">Ano</button>
          </div>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='nova-programacao'">+ Nova Programação</button>
      </div>

      <div class="calendar-toolbar">
        <div class="calendar-nav">
          <button id="cal-prev" aria-label="Anterior">◀</button>
          <h3 id="cal-title"></h3>
          <button id="cal-next" aria-label="Próximo">▶</button>
        </div>
        <button id="cal-today" class="btn btn-ghost btn-sm">Hoje</button>
      </div>

      <div class="card cal-card">
        <div class="card-body cal-body" id="cal-body"></div>
        <div class="cal-legend">
          ${GERENCIAS.map((g) => {
            const c = getGerenciaColor(g);
            return `<span class="cal-legend-item"><i style="background:${c.border}"></i>${g}</span>`;
          }).join('')}
          <span class="cal-legend-item"><i style="background:#7c3aed"></i>DUVAS</span>
        </div>
      </div>
    </div>
  `;
}

function getFiltered() {
  return getProgramacoes().filter((p) => p.status !== 'Cancelada');
}

function eventsOnDate(dateStr, items) {
  return items.filter((p) => dateStr >= p.dataInicial && dateStr <= p.dataFinal);
}

function renderEventBlock(p) {
  const ger = getGerenciaByProgramacao(p);
  const c = getGerenciaColor(ger);
  const mun = getMunicipioById(p.municipioId);
  return `<div class="cal-event-block" style="background:${c.bg};border-left:3px solid ${c.border};color:${c.text}"
    data-event-id="${p.id}" title="${p.titulo}">
    <strong>${shortTitle(p.titulo)}</strong><span>${mun?.nome || ''}</span>
  </div>`;
}

function renderMonth(items) {
  const { year, month } = calState;
  document.getElementById('cal-title').textContent = `${MESES[month]}/${year}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  const headers = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  let html = headers.map((h) => `<div class="cal-grid-header">${h}</div>`).join('');

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-grid-cell cal-other"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    const events = eventsOnDate(dateStr, items);
    html += `
      <div class="cal-grid-cell ${isToday ? 'cal-today' : ''}">
        <div class="cal-day-num">${d}</div>
        <div class="cal-events">${events.map(renderEventBlock).join('')}</div>
      </div>`;
  }
  return `<div class="cal-grid-month">${html}</div>`;
}

function renderYear(items) {
  document.getElementById('cal-title').textContent = String(calState.year);
  return MESES.map((nome, mi) => {
    const count = items.filter((p) => {
      const d = new Date(p.dataInicial + 'T12:00:00');
      return d.getFullYear() === calState.year && d.getMonth() === mi;
    }).length;
    return `<button class="cal-year-month" data-month="${mi}">${nome}<span>${count} ações</span></button>`;
  }).join('');
}

function refresh() {
  const items = getFiltered();
  const body = document.getElementById('cal-body');
  if (!body) return;
  if (calState.view === 'mes') body.innerHTML = renderMonth(items);
  else if (calState.view === 'ano') body.innerHTML = `<div class="cal-year-grid">${renderYear(items)}</div>`;
  else body.innerHTML = renderMonth(items);

  body.querySelectorAll('[data-event-id]').forEach((el) => {
    el.addEventListener('click', () => showEvent(el.dataset.eventId));
  });
  body.querySelectorAll('.cal-year-month').forEach((btn) => {
    btn.addEventListener('click', () => {
      calState.month = Number(btn.dataset.month);
      calState.view = 'mes';
      document.querySelectorAll('.view-toggle-lg button').forEach((b) => b.classList.toggle('active', b.dataset.view === 'mes'));
      refresh();
    });
  });
}

function showEvent(id) {
  const p = getProgramacoes().find((x) => x.id === id);
  if (!p) return;
  const coord = getCoordenacaoById(p.coordenacaoId);
  const mun = getMunicipioById(p.municipioId);
  showModal({
    title: p.titulo,
    body: `<div class="detail-grid">
      <div class="detail-item"><label>Gerência</label><span>${getGerenciaByProgramacao(p)}</span></div>
      <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
      <div class="detail-item"><label>Município</label><span>${mun?.nome || '—'}</span></div>
      <div class="detail-item"><label>Data Ida</label><span>${formatDate(p.dataInicial)}</span></div>
      <div class="detail-item"><label>Data Volta</label><span>${formatDate(p.dataFinal)}</span></div>
    </div>`,
    footer: `<button class="btn btn-outline" data-modal-action="edit">Editar</button><button class="btn btn-primary" data-modal-action="close">Fechar</button>`,
  }).then((a) => { if (a === 'edit') window.location.hash = `nova-programacao/edit/${id}`; });
}

export function bindCalendario() {
  refresh();
  document.querySelectorAll('.view-toggle-lg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      calState.view = btn.dataset.view;
      document.querySelectorAll('.view-toggle-lg button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      refresh();
    });
  });
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    if (calState.view === 'ano') calState.year--;
    else { calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; } }
    refresh();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    if (calState.view === 'ano') calState.year++;
    else { calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; } }
    refresh();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    const n = new Date();
    calState.year = n.getFullYear();
    calState.month = n.getMonth();
    refresh();
  });
}
