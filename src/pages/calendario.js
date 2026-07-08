import { getCollection, getItemById, canEdit } from '../services/storage.js';
import { COORDENACOES, MUNICIPIOS, REGIONAIS, getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass } from '../data/seed.js';
import { showModal } from '../components/ui.js';

let calState = {
  view: 'mes',
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  weekStart: new Date(),
  day: new Date(),
};

export function renderCalendario(user) {
  return `
    <div class="filters-bar">
      <div class="form-group">
        <label>Coordenação</label>
        <select class="form-control" id="cal-filtro-coord">
          <option value="">Todas</option>
          ${COORDENACOES.map((c) => `<option value="${c.id}">${c.sigla}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Município</label>
        <select class="form-control" id="cal-filtro-mun">
          <option value="">Todos</option>
          ${MUNICIPIOS.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Regional</label>
        <select class="form-control" id="cal-filtro-reg">
          <option value="">Todas</option>
          ${REGIONAIS.map((r) => `<option value="${r.id}">${r.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="cal-filtro-status">
          <option value="">Todos</option>
          <option>Publicada</option>
          <option>Aprovada</option>
          <option>Pendente</option>
          <option>Concluída</option>
        </select>
      </div>
    </div>

    <div class="calendar-toolbar">
      <div class="calendar-nav">
        <button id="cal-prev">◀</button>
        <h3 id="cal-title"></h3>
        <button id="cal-next">▶</button>
        <button id="cal-today" class="btn btn-ghost btn-sm">Hoje</button>
      </div>
      <div class="view-toggle">
        <button data-view="dia" class="${calState.view === 'dia' ? 'active' : ''}">Dia</button>
        <button data-view="semana" class="${calState.view === 'semana' ? 'active' : ''}">Semana</button>
        <button data-view="mes" class="${calState.view === 'mes' ? 'active' : ''}">Mês</button>
      </div>
    </div>

    <div class="card">
      <div class="card-body" id="cal-body"></div>
    </div>
  `;
}

function getFilteredProgramacoes() {
  let items = getCollection('programacoes');
  const coord = document.getElementById('cal-filtro-coord')?.value;
  const mun = document.getElementById('cal-filtro-mun')?.value;
  const reg = document.getElementById('cal-filtro-reg')?.value;
  const status = document.getElementById('cal-filtro-status')?.value;

  if (coord) items = items.filter((p) => p.coordenacaoId === coord);
  if (mun) items = items.filter((p) => p.municipioId === mun);
  if (reg) items = items.filter((p) => p.regionalId === reg);
  if (status) items = items.filter((p) => p.status === status);

  return items;
}

function getEventsForDate(dateStr, programacoes) {
  return programacoes.filter((p) => {
    const d = dateStr;
    return d >= p.dataInicial && d <= p.dataFinal;
  });
}

function renderMonthView(programacoes) {
  const { year, month } = calState;
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  document.getElementById('cal-title').textContent = `${monthNames[month]} ${year}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  const headers = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  let html = headers.map((h) => `<div class="calendar-header-cell">${h}</div>`).join('');

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="calendar-cell other-month"><div class="calendar-day-number">${prevMonthDays - i}</div></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    const events = getEventsForDate(dateStr, programacoes);

    html += `
      <div class="calendar-cell ${isToday ? 'today' : ''}">
        <div class="calendar-day-number">${d}</div>
        ${events.map((e) => `<div class="calendar-event" data-event-id="${e.id}" title="${e.titulo}">${e.titulo}</div>`).join('')}
      </div>
    `;
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-cell other-month"><div class="calendar-day-number">${i}</div></div>`;
  }

  return `<div class="calendar-grid">${html}</div>`;
}

function renderWeekView(programacoes) {
  const start = new Date(calState.weekStart);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  document.getElementById('cal-title').textContent =
    `${formatDate(start.toISOString().split('T')[0])} — ${formatDate(end.toISOString().split('T')[0])}`;

  const headers = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let html = headers.map((h) => `<div class="calendar-header-cell">${h}</div>`).join('');

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const events = getEventsForDate(dateStr, programacoes);
    html += `
      <div class="calendar-cell" style="min-height:200px">
        <div class="calendar-day-number">${d.getDate()}/${d.getMonth() + 1}</div>
        ${events.map((e) => `<div class="calendar-event" data-event-id="${e.id}">${e.titulo}</div>`).join('')}
      </div>
    `;
  }

  return `<div class="calendar-grid">${html}</div>`;
}

function renderDayView(programacoes) {
  const d = calState.day;
  const dateStr = d.toISOString().split('T')[0];
  document.getElementById('cal-title').textContent = formatDate(dateStr);
  const events = getEventsForDate(dateStr, programacoes);

  if (!events.length) {
    return '<p class="text-muted text-center">Nenhuma programação neste dia.</p>';
  }

  return `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Ação</th><th>Coordenação</th><th>Município</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${events.map((e) => {
            const coord = getCoordenacaoById(e.coordenacaoId);
            const mun = getMunicipioById(e.municipioId);
            return `
              <tr>
                <td>${e.titulo}</td>
                <td>${coord?.sigla || '—'}</td>
                <td>${mun?.nome || '—'}</td>
                <td><span class="badge ${getStatusBadgeClass(e.status)}">${e.status}</span></td>
                <td>
                  <button class="btn-icon" data-event-id="${e.id}" data-action="view">👁</button>
                  ${canEdit(JSON.parse(sessionStorage.getItem('sigp_vs_auth'))) ? `
                    <button class="btn-icon" data-event-id="${e.id}" data-action="edit">✏</button>
                    <button class="btn-icon" data-event-id="${e.id}" data-action="duplicate">📋</button>
                    <button class="btn-icon" data-event-id="${e.id}" data-action="print">🖨</button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function refreshCalendar() {
  const programacoes = getFilteredProgramacoes();
  const body = document.getElementById('cal-body');
  if (!body) return;

  if (calState.view === 'mes') body.innerHTML = renderMonthView(programacoes);
  else if (calState.view === 'semana') body.innerHTML = renderWeekView(programacoes);
  else body.innerHTML = renderDayView(programacoes);

  bindEventClicks();
}

function showEventModal(id, user) {
  const p = getItemById('programacoes', id);
  if (!p) return;
  const coord = getCoordenacaoById(p.coordenacaoId);
  const mun = getMunicipioById(p.municipioId);
  const edit = canEdit(user);

  showModal({
    title: p.titulo,
    body: `
      <div class="detail-grid">
        <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
        <div class="detail-item"><label>Município</label><span>${mun?.nome || '—'}</span></div>
        <div class="detail-item"><label>Período</label><span>${formatDate(p.dataInicial)} — ${formatDate(p.dataFinal)}</span></div>
        <div class="detail-item"><label>Status</label><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></div>
      </div>
    `,
    footer: `
      ${edit ? `
        <button class="btn btn-outline" data-modal-action="edit">✏ Editar</button>
        <button class="btn btn-outline" data-modal-action="duplicate">📋 Duplicar</button>
        <button class="btn btn-ghost" data-modal-action="print">🖨 Imprimir</button>
      ` : ''}
      <button class="btn btn-primary" data-modal-action="close">Fechar</button>
    `,
  }).then((action) => {
    if (action === 'edit') window.location.hash = `nova-programacao/edit/${id}`;
    if (action === 'duplicate') window.location.hash = `nova-programacao/duplicate/${id}`;
    if (action === 'print') window.print();
  });
}

function bindEventClicks() {
  document.querySelectorAll('[data-event-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.eventId;
      const action = el.dataset.action;
      const user = JSON.parse(sessionStorage.getItem('sigp_vs_auth'));
      if (action === 'edit') window.location.hash = `nova-programacao/edit/${id}`;
      else if (action === 'duplicate') window.location.hash = `nova-programacao/duplicate/${id}`;
      else if (action === 'print') window.print();
      else showEventModal(id, user);
    });
  });
}

export function bindCalendario(user) {
  refreshCalendar();

  ['cal-filtro-coord', 'cal-filtro-mun', 'cal-filtro-reg', 'cal-filtro-status'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', refreshCalendar);
  });

  document.querySelectorAll('.view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      calState.view = btn.dataset.view;
      document.querySelectorAll('.view-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      refreshCalendar();
    });
  });

  document.getElementById('cal-prev')?.addEventListener('click', () => {
    if (calState.view === 'mes') {
      calState.month--;
      if (calState.month < 0) { calState.month = 11; calState.year--; }
    } else if (calState.view === 'semana') {
      calState.weekStart.setDate(calState.weekStart.getDate() - 7);
    } else {
      calState.day.setDate(calState.day.getDate() - 1);
    }
    refreshCalendar();
  });

  document.getElementById('cal-next')?.addEventListener('click', () => {
    if (calState.view === 'mes') {
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
    } else if (calState.view === 'semana') {
      calState.weekStart.setDate(calState.weekStart.getDate() + 7);
    } else {
      calState.day.setDate(calState.day.getDate() + 1);
    }
    refreshCalendar();
  });

  document.getElementById('cal-today')?.addEventListener('click', () => {
    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    calState.weekStart = new Date();
    calState.day = new Date();
    refreshCalendar();
  });
}
