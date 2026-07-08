const NAV_ADMIN = [
  { route: 'dashboard', icon: '▦', label: 'Dashboard' },
  { route: 'programacoes', icon: '📅', label: 'Programações' },
  { route: 'coordenacoes', icon: '🏢', label: 'Coordenações' },
  { route: 'municipios', icon: '📍', label: 'Municípios' },
  { route: 'logistica', icon: '🚗', label: 'Logística' },
  { route: 'equipes', icon: '👥', label: 'Equipes' },
  { route: 'recursos-financeiros', icon: '💰', label: 'Recursos Financeiros' },
  { route: 'indicadores', icon: '📊', label: 'Indicadores' },
  { route: 'relatorios', icon: '📄', label: 'Relatórios' },
  { route: 'documentos', icon: '📁', label: 'Documentos' },
  { route: 'administracao', icon: '⚙', label: 'Administração' },
];

const NAV_CADASTRO = [
  { route: 'dashboard', icon: '▦', label: 'Dashboard' },
  { route: 'programacoes', icon: '📅', label: 'Programações' },
  { route: 'nova-programacao', icon: '➕', label: 'Nova Programação' },
  { route: 'calendario', icon: '📆', label: 'Calendário' },
  { route: 'equipes', icon: '👥', label: 'Equipes' },
  { route: 'documentos', icon: '📁', label: 'Documentos' },
  { route: 'relatorios', icon: '📄', label: 'Relatórios' },
];

const NAV_CONSULTA = [
  { route: 'dashboard', icon: '▦', label: 'Dashboard' },
  { route: 'programacoes', icon: '📅', label: 'Programações' },
  { route: 'calendario', icon: '📆', label: 'Calendário' },
  { route: 'relatorios', icon: '📄', label: 'Relatórios' },
  { route: 'documentos', icon: '📁', label: 'Documentos' },
];

function getNavItems(user) {
  if (user.perfil === 'Administrador') return NAV_ADMIN;
  if (user.perfil === 'Gerência') return NAV_CADASTRO;
  return NAV_CONSULTA;
}

export function renderSidebar(user, currentRoute) {
  const initials = user.nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const items = getNavItems(user);

  return `
    <aside class="sidebar sidebar-v2" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logos">
          <img src="/assets/logo-sesapi.svg" alt="SESAPI" class="sidebar-logo" />
          <img src="/assets/logo-duvas.svg" alt="DUVAS" class="sidebar-logo" />
        </div>
        <div class="sidebar-brand">
          <strong>SIGP-VS</strong>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${items.map((item) => `
          <button class="nav-item ${currentRoute === item.route ? 'active' : ''}" data-route="${item.route}">
            <span class="nav-icon">${item.icon}</span>
            ${item.label}
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar user-avatar-photo">${initials}</div>
          <div class="user-details">
            <strong>${user.nome}</strong>
            <span>${user.perfil}</span>
          </div>
        </div>
        <button class="btn btn-sidebar-logout btn-sm btn-block" id="btn-logout">Sair</button>
      </div>
    </aside>
  `;
}

export function renderTopbar(title, breadcrumb = '', user) {
  const isCadastroForm = title === 'Nova Programação';
  const crumbs = isCadastroForm
    ? `<nav class="breadcrumb-nav"><a href="#dashboard">Início</a> / <a href="#programacoes">Programações</a> / <strong>Nova Programação</strong></nav>`
    : breadcrumb
      ? `<span class="breadcrumb">${breadcrumb}</span>`
      : '';

  return `
    <header class="topbar topbar-v2">
      <div class="topbar-left">
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
        ${crumbs || `<h1 class="page-title">${title}</h1>`}
      </div>
      <div class="topbar-right">
        <button class="topbar-icon-btn" title="Notificações" aria-label="Notificações">
          🔔<span class="notif-badge">3</span>
        </button>
        <button class="topbar-icon-btn" title="Ajuda" aria-label="Ajuda">?</button>
      </div>
    </header>
  `;
}

export function bindLayoutEvents(onNavigate, onLogout) {
  document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route;
      if (route === 'recursos-financeiros' || route === 'indicadores') {
        window.location.hash = 'relatorios';
        return;
      }
      onNavigate(route);
    });
  });

  document.getElementById('btn-logout')?.addEventListener('click', onLogout);

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

export function renderAppShell(user, route, title, content, breadcrumb) {
  return `
    <div class="app-layout ${user.perfil === 'Administrador' ? 'layout-admin' : 'layout-cadastro'}">
      ${renderSidebar(user, route)}
      <div class="main-content">
        ${renderTopbar(title, breadcrumb, user)}
        <main class="page-content">${content}</main>
      </div>
    </div>
  `;
}
