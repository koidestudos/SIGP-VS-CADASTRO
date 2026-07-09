import { canViewBI } from '../services/roles.js';
import { getUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notifications-service.js';
import { getCoordenacaoById } from '../data/seed.js';

const NAV_OPERACIONAL = [
  { route: 'dashboard', icon: '▦', label: 'Dashboard' },
  { route: 'programacoes', icon: '📅', label: 'Programações' },
  { route: 'nova-programacao', icon: '➕', label: 'Nova Programação' },
  { route: 'calendario', icon: '📆', label: 'Calendário' },
  { route: 'coordenacoes', icon: '🏢', label: 'Coordenações' },
  { route: 'municipios', icon: '📍', label: 'Municípios' },
  { route: 'logistica', icon: '🚗', label: 'Logística' },
  { route: 'equipes', icon: '👥', label: 'Equipes' },
];

const NAV_GERENCIAL = [
  { route: 'bi-gerencial', icon: '📊', label: 'BI Gerencial' },
  { route: 'administracao', icon: '⚙', label: 'Administração' },
];

export function renderSidebar(user, currentRoute) {
  const initials = user.nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrador' : 'Usuário';
  const navOperacional = NAV_OPERACIONAL;
  const navGerencial = NAV_GERENCIAL.filter((item) => {
    if (item.route === 'bi-gerencial' || item.route === 'administracao') return canViewBI(user);
    return true;
  });

  return `
    <aside class="sidebar sidebar-v2" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logos">
          <img src="/assets/logo-sesapi.svg" alt="SESAPI" class="sidebar-logo" />
          <img src="/assets/logo-duvas.svg" alt="DUVAS" class="sidebar-logo" />
        </div>
        <div class="sidebar-brand"><strong>SIGP-VS</strong></div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Portal Operacional</div>
        ${navOperacional.map((item) => `
          <button class="nav-item ${currentRoute === item.route ? 'active' : ''}" data-route="${item.route}">
            <span class="nav-icon">${item.icon}</span>${item.label}
          </button>
        `).join('')}
        ${navGerencial.length ? `
          <div class="nav-section-label mt-2">Portal Gerencial</div>
          ${navGerencial.map((item) => `
            <button class="nav-item ${currentRoute === item.route ? 'active' : ''}" data-route="${item.route}">
              <span class="nav-icon">${item.icon}</span>${item.label}
            </button>
          `).join('')}
        ` : ''}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar user-avatar-photo">${initials}</div>
          <div class="user-details">
            <strong>${user.nome}</strong>
            <span class="user-role-badge ${user.role === 'admin' ? 'role-admin' : ''}">${roleLabel}</span>
            <span>${user.email || ''}</span>
          </div>
        </div>
        <button class="btn btn-sidebar-logout btn-sm btn-block" id="btn-logout">Sair</button>
      </div>
    </aside>`;
}

export function renderTopbar(title, breadcrumb = '', { showNotifications = false } = {}) {
  const unread = showNotifications ? getUnreadCount() : 0;
  const crumbs = breadcrumb || (title ? `<h1 class="page-title">${title}</h1>` : '');
  return `
    <header class="topbar topbar-v2">
      <div class="topbar-left">
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
        ${typeof breadcrumb === 'string' && breadcrumb.includes('/')
          ? `<nav class="breadcrumb-nav">${breadcrumb}</nav>`
          : crumbs}
      </div>
      <div class="topbar-right">
        ${showNotifications ? `
          <div class="notif-wrap">
            <button class="topbar-icon-btn" id="btn-notifications" title="Notificações">🔔
              ${unread ? `<span class="notif-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
            </button>
            <div class="notif-panel hidden" id="notif-panel">
              <div class="notif-panel-header">
                <strong>Notificações</strong>
                <button class="btn btn-ghost btn-sm" id="notif-mark-all">Marcar todas lidas</button>
              </div>
              <div class="notif-list" id="notif-list">${renderNotifList()}</div>
            </div>
          </div>` : ''}
        <button class="topbar-icon-btn" title="Ajuda">?</button>
      </div>
    </header>`;
}

function renderNotifList() {
  const items = getNotifications();
  if (!items.length) return '<p class="notif-empty">Nenhuma notificação.</p>';
  return items.slice(0, 20).map((n) => {
    const coord = getCoordenacaoById(n.coordenacaoId);
    const time = n.criadoEm ? new Date(n.criadoEm).toLocaleString('pt-BR') : '';
    return `
      <button type="button" class="notif-item ${n.lido ? '' : 'unread'}" data-notif-id="${n.id}" data-prog-id="${n.programacaoId || ''}">
        <strong>${n.lido ? '' : '● '}${n.titulo}</strong>
        <span>Nova programação aguardando aprovação${coord ? ` — ${coord.sigla}` : ''}</span>
        <small>${time}</small>
      </button>`;
  }).join('');
}

export function bindNotifications() {
  const btn = document.getElementById('btn-notifications');
  const panel = document.getElementById('notif-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    const list = document.getElementById('notif-list');
    if (list) list.innerHTML = renderNotifList();
  });

  document.getElementById('notif-mark-all')?.addEventListener('click', async () => {
    await markAllNotificationsRead();
    const list = document.getElementById('notif-list');
    if (list) list.innerHTML = renderNotifList();
    btn.querySelector('.notif-badge')?.remove();
  });

  panel.addEventListener('click', async (e) => {
    const item = e.target.closest('.notif-item');
    if (!item) return;
    await markNotificationRead(item.dataset.notifId);
    if (item.dataset.progId) window.location.hash = 'programacoes';
    panel.classList.add('hidden');
  });

  document.addEventListener('click', () => panel.classList.add('hidden'));
  panel.addEventListener('click', (e) => e.stopPropagation());
}

export function refreshNotificationBadge() {
  const btn = document.getElementById('btn-notifications');
  if (!btn) return;
  const unread = getUnreadCount();
  const existing = btn.querySelector('.notif-badge');
  if (unread && !existing) {
    btn.insertAdjacentHTML('beforeend', `<span class="notif-badge">${unread > 9 ? '9+' : unread}</span>`);
  } else if (!unread && existing) {
    existing.remove();
  } else if (existing) {
    existing.textContent = unread > 9 ? '9+' : unread;
  }
  const list = document.getElementById('notif-list');
  if (list && !document.getElementById('notif-panel')?.classList.contains('hidden')) {
    list.innerHTML = renderNotifList();
  }
}

export function bindLayoutEvents(onNavigate, onLogout) {
  document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.route));
  });
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  bindNotifications();
}

export function renderAppShell(user, route, title, content, breadcrumb) {
  const bc = breadcrumb || '';
  const showNotifications = canViewBI(user);
  return `
    <div class="app-layout layout-admin">
      ${renderSidebar(user, route)}
      <div class="main-content">
        ${renderTopbar(title, bc || title, { showNotifications })}
        <main class="page-content">${content}</main>
      </div>
    </div>`;
}

export function breadcrumbHtml(parts) {
  return parts.map((p, i) => {
    if (i === parts.length - 1) return `<strong>${p.label}</strong>`;
    return `<a href="${p.href}">${p.label}</a>`;
  }).join(' / ');
}
