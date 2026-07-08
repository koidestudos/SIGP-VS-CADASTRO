const NAV_ITEMS = [
  { route: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { route: 'programacoes', icon: '📅', label: 'Programações' },
  { route: 'nova-programacao', icon: '➕', label: 'Nova Programação' },
  { route: 'calendario', icon: '📆', label: 'Calendário' },
  { route: 'coordenacoes', icon: '🏢', label: 'Coordenações' },
  { route: 'municipios', icon: '📍', label: 'Municípios' },
  { route: 'logistica', icon: '🚗', label: 'Logística' },
  { route: 'equipes', icon: '👥', label: 'Equipes' },
  { route: 'relatorios', icon: '📄', label: 'Relatórios' },
  { route: 'documentos', icon: '📁', label: 'Documentos' },
  { route: 'administracao', icon: '⚙', label: 'Administração', adminOnly: true },
];

export function renderSidebar(user, currentRoute) {
  const initials = user.nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user.perfil === 'Administrador');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <strong>SIGP-VS</strong>
          <span>Sistema Integrado de Gestão de Programações da Vigilância em Saúde</span>
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
          <div class="user-avatar">${initials}</div>
          <div class="user-details">
            <strong>${user.nome}</strong>
            <span>${user.perfil}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm btn-block" id="btn-logout" style="color:#fff;border-color:rgba(255,255,255,0.3)">Sair</button>
      </div>
    </aside>
  `;
}

export function renderTopbar(title, breadcrumb = '') {
  return `
    <header class="topbar">
      <div class="topbar-left">
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="topbar-right">
        ${breadcrumb ? `<span class="breadcrumb">${breadcrumb}</span>` : ''}
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
  return `
    <div class="app-layout">
      ${renderSidebar(user, route)}
      <div class="main-content">
        ${renderTopbar(title, breadcrumb)}
        <main class="page-content">${content}</main>
      </div>
    </div>
  `;
}
