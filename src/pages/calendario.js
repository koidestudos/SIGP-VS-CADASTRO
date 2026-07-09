import { getProgramacoes } from '../services/programacoes-service.js';
import {
  COORDENACOES, getCoordenacaoById, getMunicipioById, getGerenciaByProgramacao,
  getGerenciaColor, shortTitle, formatDate, GERENCIAS,
} from '../data/seed.js';
import { showModal } from '../components/ui.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const now = new Date();
let calState = { view: 'mes', year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function currentDateStr() {
  return dateStr(calState.year, calState.month, calState.day);
}

export function renderCalendario() {
  return `
    <div class="cal-page">
      <div class="cal-page-header">
        <div class="cal-view-bar">
          <span class="cal-view-label">Visualização:</span>
          <div class="view-toggle view-toggle-lg" id="cal-view-toggle">
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
          <span class="cal-legend-item"><i style="border:2px dashed #1351B4;background:#fff"></i>Programada</span>
          <span class="cal-legend-item"><i style="background:#168821"></i>Autorizado ✓</span>
        </div>
      </div>
    </div>
  `;
}

function getFiltered() {
  return getProgramacoes().filter((p) => p.status !== 'Cancelada');
}

function eventsOnDate(ds, items) {
  return items.filter((p) => ds >= p.dataInicial && ds <= p.dataFinal);
}

function renderEventBlock(p, large = false) {
  const ger = getGerenciaByProgramacao(p);
  const c = getGerenciaColor(ger);
  const mun = getMunicipioById(p.municipioId);
  const autorizado = p.status === 'Autorizado' || p.status === 'Aprovado';
  const borderStyle = autorizado ? 'solid' : 'dashed';
  const opacity = autorizado ? '1' : '0.92';
  const cls = large ? 'cal-event-block cal-event-lg' : 'cal-event-block';
  return `<div class="${cls}" style="background:${c.bg};border-left:3px ${borderStyle} ${c.border};color:${c.text};opacity:${opacity}"
    data-event-id="${p.id}" title="${p.titulo}${autorizado ? ' (Autorizado)' : ' (Programada)'}">
    <strong>${large ? p.titulo : shortTitle(p.titulo)}</strong><span>${mun?.nome || ''}${autorizado ? ' ✓' : ''}</span>
  </div>`;
}

function renderMonth(items) {
  const { year, month } = calState;
  document.getElementById('cal-title').textContent = `${MESES[month]}/${year}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();

  let html = DIAS_CURTOS.map((h) => `<div class="cal-grid-header">${h}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-grid-cell cal-other"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(year, month, d);
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    const events = eventsOnDate(ds, items);
    html += `
      <div class="cal-grid-cell ${isToday ? 'cal-today' : ''} cal-clickable-day" data-day="${d}">
        <div class="cal-day-num">${d}</div>
        <div class="cal-events">${events.map((e) => renderEventBlock(e)).join('')}</div>
      </div>`;
  }
  return `<div class="cal-grid-month">${html}</div>`;
}

function renderDay(items) {
  const { year, month, day } = calState;
  const ds = dateStr(year, month, day);
  const weekday = DIAS_SEM[new Date(year, month, day).getDay()];
  document.getElementById('cal-title').textContent = `${weekday}, ${day} de ${MESES[month]} de ${year}`;
  const events = eventsOnDate(ds, items);
  return `
    <div class="cal-day-view">
      <div class="cal-day-summary">
        <span class="cal-day-count">${events.length} programação(ões)</span>
      </div>
      <div class="cal-day-events">
        ${events.length
          ? events.map((e) => renderEventBlock(e, true)).join('')
          : '<p class="text-muted text-center cal-empty">Nenhuma programação neste dia.</p>'}
      </div>
    </div>`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function renderWeek(items) {
  const anchor = new Date(calState.year, calState.month, calState.day);
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const end = days[6];
  document.getElementById('cal-title').textContent =
    `${days[0].getDate()} ${MESES[days[0].getMonth()].slice(0, 3)} — ${end.getDate()} ${MESES[end.getMonth()].slice(0, 3)}/${end.getFullYear()}`;

  const today = new Date();
  let html = DIAS_CURTOS.map((h) => `<div class="cal-grid-header">${h}</div>`).join('');
  days.forEach((d) => {
    const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
    const isToday = d.toDateString() === today.toDateString();
    const events = eventsOnDate(ds, items);
    html += `
      <div class="cal-grid-cell cal-week-cell ${isToday ? 'cal-today' : ''} cal-clickable-day"
        data-day="${d.getDate()}" data-month="${d.getMonth()}" data-year="${d.getFullYear()}">
        <div class="cal-day-num">${d.getDate()}</div>
        <div class="cal-events">${events.map((e) => renderEventBlock(e)).join('')}</div>
      </div>`;
  });
  return `<div class="cal-grid-week">${html}</div>`;
}

function renderYear(items) {
  const { year } = calState;
  const total = items.filter((p) => new Date(p.dataInicial + 'T12:00:00').getFullYear() === year).length;
  document.getElementById('cal-title').textContent = `${year} — ${total} programações`;
  return MESES.map((nome, mi) => {
    const monthItems = items.filter((p) => {
      const d = new Date(p.dataInicial + 'T12:00:00');
      return d.getFullYear() === year && d.getMonth() === mi;
    });
    const count = monthItems.length;
    const daysWithEvents = new Set(monthItems.map((p) => p.dataInicial.slice(8, 10))).size;
    return `
      <button type="button" class="cal-year-month" data-month="${mi}">
        <strong>${nome}</strong>
        <span>${count} ações</span>
        <small>${daysWithEvents} dia(s) com atividade</small>
        <div class="cal-year-bar"><i style="width:${Math.min(100, count * 3)}%"></i></div>
      </button>`;
  }).join('');
}

function bindEvents(body) {
  body.querySelectorAll('[data-event-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showEvent(el.dataset.eventId);
    });
  });
  body.querySelectorAll('.cal-clickable-day').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('[data-event-id]')) return;
      calState.day = Number(cell.dataset.day);
      if (cell.dataset.month != null) calState.month = Number(cell.dataset.month);
      if (cell.dataset.year != null) calState.year = Number(cell.dataset.year);
      calState.view = 'dia';
      document.querySelectorAll('#cal-view-toggle button').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === 'dia');
      });
      refresh();
    });
  });
  body.querySelectorAll('.cal-year-month').forEach((btn) => {
    btn.addEventListener('click', () => {
      calState.month = Number(btn.dataset.month);
      calState.view = 'mes';
      document.querySelectorAll('#cal-view-toggle button').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === 'mes');
      });
      refresh();
    });
  });
}

function refresh() {
  const items = getFiltered();
  const body = document.getElementById('cal-body');
  if (!body) return;
  if (calState.view === 'dia') body.innerHTML = renderDay(items);
  else if (calState.view === 'semana') body.innerHTML = renderWeek(items);
  else if (calState.view === 'ano') body.innerHTML = `<div class="cal-year-grid">${renderYear(items)}</div>`;
  else body.innerHTML = renderMonth(items);
  bindEvents(body);
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
  document.querySelectorAll('#cal-view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      calState.view = btn.dataset.view;
      document.querySelectorAll('#cal-view-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      refresh();
    });
  });
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    if (calState.view === 'ano') calState.year--;
    else if (calState.view === 'dia') {
      const d = new Date(calState.year, calState.month, calState.day - 1);
      calState.year = d.getFullYear(); calState.month = d.getMonth(); calState.day = d.getDate();
    } else if (calState.view === 'semana') {
      const d = new Date(calState.year, calState.month, calState.day - 7);
      calState.year = d.getFullYear(); calState.month = d.getMonth(); calState.day = d.getDate();
    } else {
      calState.month--;
      if (calState.month < 0) { calState.month = 11; calState.year--; }
    }
    refresh();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    if (calState.view === 'ano') calState.year++;
    else if (calState.view === 'dia') {
      const d = new Date(calState.year, calState.month, calState.day + 1);
      calState.year = d.getFullYear(); calState.month = d.getMonth(); calState.day = d.getDate();
    } else if (calState.view === 'semana') {
      const d = new Date(calState.year, calState.month, calState.day + 7);
      calState.year = d.getFullYear(); calState.month = d.getMonth(); calState.day = d.getDate();
    } else {
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
    }
    refresh();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    const n = new Date();
    calState.year = n.getFullYear();
    calState.month = n.getMonth();
    calState.day = n.getDate();
    refresh();
  });
}
