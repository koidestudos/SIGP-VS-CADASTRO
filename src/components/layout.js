import { canViewBI } from '../services/roles.js';
import { getUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notifications-service.js';
import {
  getOpenChats, fetchSuporteAdmins, getOrCreateUserChat, watchSuporteMessages,
  sendSuporteMessage, finalizarSuporteChat, subscribeSuporteMessages, subscribeSuporteChats,
  getUnreadSuporteCount, markSuporteChatRead, iniciarConversaAdmin,
} from '../services/suporte-service.js';
import { getCoordenacaoById } from '../data/seed.js';

let suporteUser = null;
let activeSuporteChatId = null;
let suporteMessages = [];

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
      <div class="sidebar-header sidebar-branding">
        <div class="brand-top-row">
          <img src="/assets/logo-sesapi.svg" alt="SESAPI" class="sidebar-logo-sesapi" />
          <div class="brand-divider-v"></div>
          <div class="brand-duvas">
            <strong>DUVAS</strong>
            <span>Diretoria de Vigilância em Saúde</span>
          </div>
        </div>
        <div class="brand-sigp-block">
          <strong>SIGP-VS</strong>
          <span>Sistema Integrado de Gestão de Programações da Vigilância em Saúde</span>
        </div>
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

export function renderTopbar(title, breadcrumb = '', { showNotifications = false, user = null } = {}) {
  const unread = showNotifications ? getUnreadCount() : 0;
  const suporteUnread = user ? getUnreadSuporteCount(user.role === 'admin') : 0;
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
        <div class="notif-wrap">
          <button class="topbar-icon-btn" id="btn-suporte" title="Suporte / Ajuda">?
            ${suporteUnread ? `<span class="notif-badge">${suporteUnread > 9 ? '9+' : suporteUnread}</span>` : ''}
          </button>
          <div class="notif-panel suporte-panel hidden" id="suporte-panel">
            <div class="notif-panel-header"><strong>Suporte DUVAS</strong></div>
            <div id="suporte-content"><p class="notif-empty">Carregando...</p></div>
          </div>
        </div>
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
        <span>Nova programação aguardando aprovação${coord ? ` — ${coord.nome}` : ''}</span>
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

export function refreshSuporteBadge() {
  const btn = document.getElementById('btn-suporte');
  if (!btn || !suporteUser) return;
  const count = getUnreadSuporteCount(suporteUser.role === 'admin');
  const existing = btn.querySelector('.notif-badge');
  if (count && !existing) {
    btn.insertAdjacentHTML('beforeend', `<span class="notif-badge">${count > 9 ? '9+' : count}</span>`);
  } else if (!count && existing) {
    existing.remove();
  } else if (existing) {
    existing.textContent = count > 9 ? '9+' : count;
  }
  if (!document.getElementById('suporte-panel')?.classList.contains('hidden')) {
    renderSuportePanelContent();
  }
}

function bindSuporteInputHandlers() {
  const input = document.getElementById('suporte-input');
  const send = () => document.getElementById('suporte-send')?.click();
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
}

function renderSuporteMessagesHtml() {
  if (!suporteMessages.length) return '<p class="notif-empty">Nenhuma mensagem ainda. Envie sua dúvida.</p>';
  return suporteMessages.map((m) => {
    if (m.tipo === 'sistema') {
      return `<div class="chat-msg chat-system"><em>${m.texto}</em></div>`;
    }
    return `
    <div class="chat-msg ${m.isAdmin ? 'chat-admin' : 'chat-user'}">
      <strong>${m.autorNome}</strong>
      <p>${m.texto}</p>
      <small>${m.criadoEm ? new Date(m.criadoEm).toLocaleString('pt-BR') : ''}</small>
    </div>`;
  }).join('');
}

function renderSuporteCompose(showFinish = true) {
  return `
    <div class="suporte-compose">
      <textarea class="form-control" id="suporte-input" rows="2" placeholder="Digite sua mensagem... (Enter para enviar)"></textarea>
      <div class="suporte-actions">
        <button class="btn btn-primary btn-sm" id="suporte-send">Enviar</button>
        ${showFinish ? '<button class="btn btn-outline btn-sm" id="suporte-finish">Finalizar conversa</button>' : ''}
      </div>
    </div>`;
}

async function renderSuportePanelContent() {
  const el = document.getElementById('suporte-content');
  if (!el || !suporteUser) return;
  const isAdmin = suporteUser.role === 'admin';

  if (isAdmin) {
    const chats = getOpenChats();
    if (!activeSuporteChatId) {
      el.innerHTML = chats.length ? `<div class="suporte-chat-list">${chats.map((c) => `
        <div class="suporte-chat-row ${c.naoLidoAdmin ? 'unread' : ''}">
          <div class="suporte-chat-info">
            <strong>${c.userNome}${c.naoLidoAdmin ? ' ●' : ''}</strong>
            <span>${c.ultimaMensagem || c.userEmail || 'Nova conversa'}</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-open-chat="${c.id}">Chat</button>
        </div>`).join('')}</div>` : '<p class="notif-empty">Nenhum chat aberto.</p>';
      el.querySelectorAll('[data-open-chat]').forEach((b) => b.addEventListener('click', async () => {
        activeSuporteChatId = b.dataset.openChat;
        watchSuporteMessages(activeSuporteChatId);
        const chat = chats.find((c) => c.id === activeSuporteChatId);
        if (!chat?.adminIniciou) {
          await iniciarConversaAdmin(activeSuporteChatId, suporteUser.nome);
        } else {
          await markSuporteChatRead(activeSuporteChatId, true);
        }
        renderSuportePanelContent();
      }));
      return;
    }
    const chat = chats.find((c) => c.id === activeSuporteChatId);
    el.innerHTML = `
      <div class="suporte-chat-header"><button class="btn btn-ghost btn-sm" id="suporte-back">← Voltar</button>
        <strong>${chat?.userNome || 'Usuário'}</strong></div>
      <div class="suporte-messages" id="suporte-messages">${renderSuporteMessagesHtml()}</div>
      ${renderSuporteCompose(true)}`;
    document.getElementById('suporte-back')?.addEventListener('click', () => { activeSuporteChatId = null; renderSuportePanelContent(); });
    document.getElementById('suporte-send')?.addEventListener('click', async () => {
      const t = document.getElementById('suporte-input')?.value;
      await sendSuporteMessage(activeSuporteChatId, t, { nome: suporteUser.nome, isAdmin: true });
      document.getElementById('suporte-input').value = '';
    });
    document.getElementById('suporte-finish')?.addEventListener('click', async () => {
      await finalizarSuporteChat(activeSuporteChatId);
      activeSuporteChatId = null;
      renderSuportePanelContent();
    });
    bindSuporteInputHandlers();
    document.getElementById('suporte-messages')?.scrollTo(0, 99999);
    return;
  }

  const admins = await fetchSuporteAdmins();
  const chats = getOpenChats();
  if (!activeSuporteChatId) {
    el.innerHTML = `
      <p class="text-sm text-muted" style="padding:12px">Fale com a administração:</p>
      <div class="suporte-chat-list">${admins.map((a) => `
        <button type="button" class="notif-item" data-start-admin="${a.id}">
          <strong>${a.nome}</strong><span>Administrador</span>
        </button>`).join('') || '<p class="notif-empty">Nenhum administrador disponível.</p>'}
      </div>`;
    el.querySelectorAll('[data-start-admin]').forEach((b) => b.addEventListener('click', async () => {
      activeSuporteChatId = chats[0]?.id || await getOrCreateUserChat(suporteUser);
      watchSuporteMessages(activeSuporteChatId);
      renderSuportePanelContent();
    }));
    return;
  }
  await markSuporteChatRead(activeSuporteChatId, false);
  el.innerHTML = `
    <div class="suporte-chat-header"><strong>Suporte — Administração</strong></div>
    <div class="suporte-messages" id="suporte-messages">${renderSuporteMessagesHtml()}</div>
    ${renderSuporteCompose(true)}`;
  document.getElementById('suporte-send')?.addEventListener('click', async () => {
    const t = document.getElementById('suporte-input')?.value;
    await sendSuporteMessage(activeSuporteChatId, t, { nome: suporteUser.nome, isAdmin: false });
    document.getElementById('suporte-input').value = '';
  });
  document.getElementById('suporte-finish')?.addEventListener('click', async () => {
    await finalizarSuporteChat(activeSuporteChatId);
    activeSuporteChatId = null;
    renderSuportePanelContent();
  });
  bindSuporteInputHandlers();
  document.getElementById('suporte-messages')?.scrollTo(0, 99999);
}

export function bindSuporte(user) {
  suporteUser = user;
  subscribeSuporteChats(() => refreshSuporteBadge());
  subscribeSuporteMessages((msgs) => {
    suporteMessages = msgs;
    refreshSuporteBadge();
    if (activeSuporteChatId && !document.getElementById('suporte-panel')?.classList.contains('hidden')) {
      const msgEl = document.getElementById('suporte-messages');
      if (msgEl) {
        msgEl.innerHTML = renderSuporteMessagesHtml();
        msgEl.scrollTo(0, 99999);
      }
    }
  });
  const btn = document.getElementById('btn-suporte');
  const panel = document.getElementById('suporte-panel');
  if (!btn || !panel) return;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) await renderSuportePanelContent();
  });
  document.addEventListener('click', () => panel.classList.add('hidden'));
  panel.addEventListener('click', (e) => e.stopPropagation());
}

export function bindLayoutEvents(onNavigate, onLogout, user) {
  document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.route));
  });
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  bindNotifications();
  if (user) bindSuporte(user);
}

export function renderAppShell(user, route, title, content, breadcrumb) {
  const bc = breadcrumb || '';
  const showNotifications = canViewBI(user);
  return `
    <div class="app-layout layout-admin">
      ${renderSidebar(user, route)}
      <div class="main-content">
        ${renderTopbar(title, bc || title, { showNotifications, user })}
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
