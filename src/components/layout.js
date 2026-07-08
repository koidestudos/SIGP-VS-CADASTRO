const NAV_ITEMS = [
  { route: 'dashboard', icon: '▦', label: 'Dashboard' },
  { route: 'programacoes', icon: '📅', label: 'Programações' },
  { route: 'nova-programacao', icon: '➕', label: 'Nova Programação' },
  { route: 'calendario', icon: '📆', label: 'Calendário' },
  { route: 'coordenacoes', icon: '🏢', label: 'Coordenações' },
  { route: 'municipios', icon: '📍', label: 'Municípios' },
  { route: 'logistica', icon: '🚗', label: 'Logística' },
  { route: 'equipes', icon: '👥', label: 'Equipes' },
  { route: 'indicadores', icon: '📊', label: 'Indicadores' },
  { route: 'relatorios', icon: '📄', label: 'Relatórios' },
  { route: 'administracao', icon: '⚙', label: 'Administração' },
];

export function renderSidebar(user, currentRoute) {
  const initials = user.nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

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
        ${NAV_ITEMS.map((item) => `
          <button class="nav-item ${currentRoute === item.route ? 'active' : ''}" data-route="${item.route}">
            <span class="nav-icon">${item.icon}</span>${item.label}
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar user-avatar-photo">${initials}</div>
          <div class="user-details">
            <strong>${user.nome}</strong>
            <span>${user.email || ''}</span>
          </div>
        </div>
        <button class="btn btn-sidebar-logout btn-sm btn-block" id="btn-logout">Sair</button>
      </div>
    </aside>
  `;
}

export function renderTopbar(title, breadcrumb = '') {
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
        <button class="topbar-icon-btn" title="Notificações">🔔</button>
        <button class="topbar-icon-btn" title="Ajuda">?</button>
      </div>
    </header>
  `;
}

export function bindLayoutEvents(onNavigate, onLogout) {
  document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.route));
  });
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

export function renderAppShell(user, route, title, content, breadcrumb) {
  const bc = breadcrumb || '';
  return `
    <div class="app-layout layout-admin">
      ${renderSidebar(user, route)}
      <div class="main-content">
        ${renderTopbar(title, bc || title)}
        <main class="page-content">${content}</main>
      </div>
    </div>
  `;
}

export function breadcrumbHtml(parts) {
  return parts.map((p, i) => {
    if (i === parts.length - 1) return `<strong>${p.label}</strong>`;
    return `<a href="${p.href}">${p.label}</a>`;
  }).join(' / ');
}
