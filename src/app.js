import { renderAppShell, bindLayoutEvents, breadcrumbHtml, syncSidebarChrome, syncTopbarTitle } from './components/layout.js';
import { logoutUser } from './services/auth.js';
import { renderDashboard, bindDashboard } from './pages/dashboard.js';
import { renderProgramacoes, bindProgramacoes } from './pages/programacoes.js';
import { renderNovaProgramacao, bindNovaProgramacao, resetWizardSession } from './pages/nova-programacao.js';
import { renderCalendario, bindCalendario } from './pages/calendario.js';
import { renderCoordenacoes, bindCoordenacoes } from './pages/coordenacoes.js';
import { renderMunicipios, bindMunicipios } from './pages/municipios.js';
import { renderLogistica, bindLogistica } from './pages/logistica.js';
import { renderEquipes, bindEquipes } from './pages/equipes.js';
import { renderBiGerencial, bindBiGerencial } from './pages/bi-gerencial.js';
import { renderGerencias, bindGerencias } from './pages/gerencias.js';
import { renderAdministracao, bindAdministracao, unbindAdministracao } from './pages/administracao.js';
import { canAccessAdmin, canViewGerencias, canCreateProgramacao } from './services/roles.js';

const PAGE_META = {
  dashboard: { title: 'Dashboard', render: renderDashboard, bind: bindDashboard },
  programacoes: { title: 'Programações', render: renderProgramacoes, bind: bindProgramacoes },
  'bi-gerencial': { title: 'BI Gerencial', render: renderBiGerencial, bind: bindBiGerencial },
  'nova-programacao': {
    title: 'Nova Programação',
    render: renderNovaProgramacao,
    bind: bindNovaProgramacao,
    breadcrumb: () => breadcrumbHtml([
      { label: 'Início', href: '#dashboard' },
      { label: 'Programações', href: '#programacoes' },
      { label: 'Nova Programação', href: '' },
    ]),
  },
  calendario: {
    title: 'Calendário',
    render: renderCalendario,
    bind: bindCalendario,
    breadcrumb: () => breadcrumbHtml([
      { label: 'Início', href: '#dashboard' },
      { label: 'Programações', href: '#programacoes' },
      { label: 'Calendário', href: '' },
    ]),
  },
  coordenacoes: { title: 'Coordenações', render: renderCoordenacoes, bind: bindCoordenacoes },
  municipios: { title: 'Municípios', render: renderMunicipios, bind: bindMunicipios },
  logistica: { title: 'Logística', render: renderLogistica, bind: bindLogistica },
  equipes: { title: 'Equipes', render: renderEquipes, bind: bindEquipes },
  gerencias: { title: 'Gerências', render: renderGerencias, bind: bindGerencias },
  administracao: { title: 'Administração', render: renderAdministracao, bind: bindAdministracao },
};

let bindGeneration = 0;
let lastShellKey = '';
let lastBoundRoute = '';

function shellKey(user, route) {
  return `${user?.uid || ''}|${user?.role || ''}|${user?.gerencia || ''}|${route}`;
}

function bindSoon(fn) {
  const generation = ++bindGeneration;
  setTimeout(() => {
    if (generation !== bindGeneration) return;
    fn();
  }, 0);
}

export function resetAppShell() {
  lastShellKey = '';
  lastBoundRoute = '';
  unbindAdministracao();
}

export function renderApp(user, route, params) {
  if ((route === 'bi-gerencial' || route === 'administracao') && !canAccessAdmin(user)) {
    route = 'dashboard';
  }
  if (route === 'gerencias' && !canViewGerencias(user)) {
    route = 'dashboard';
  }
  if (route === 'nova-programacao' && !canCreateProgramacao(user)) {
    route = 'programacoes';
  }
  if (route !== 'nova-programacao') {
    resetWizardSession();
  }
  const page = PAGE_META[route] || PAGE_META.dashboard;
  const content = page.render(user, params);
  // Hash da Administração (#administracao/contas) não deve virar título da topbar.
  const breadcrumb = page.breadcrumb
    ? page.breadcrumb()
    : (route === 'administracao' ? '' : (params.length ? params.join(' / ') : ''));
  const html = renderAppShell(user, route, page.title, content, breadcrumb);
  document.title = `SIGP-VS — ${page.title}`;

  return {
    html,
    route,
    title: page.title,
    bindLayout() {
      bindLayoutEvents(
        (r) => { window.location.hash = r; },
        async () => { await logoutUser(); window.location.hash = 'login'; },
        user,
      );
    },
    bindPage() {
      page.bind?.(user, params);
    },
  };
}

export function mountApp(container, user, route, params) {
  const next = renderApp(user, route, params);
  const nextKey = shellKey(user, next.route);
  const layout = container.querySelector('.app-layout');
  const contentEl = container.querySelector('.page-content');
  const canReuse = Boolean(
    layout
    && contentEl
    && lastShellKey === nextKey
    && next.route !== 'nova-programacao',
  );

  if (lastBoundRoute === 'administracao' && next.route !== 'administracao') {
    unbindAdministracao();
  }

  if (canReuse) {
    const tmp = document.createElement('div');
    tmp.innerHTML = next.html;
    const newContent = tmp.querySelector('.page-content');
    if (newContent) contentEl.innerHTML = newContent.innerHTML;
    syncTopbarTitle(next.title);
    syncSidebarChrome(user, next.route);
    lastBoundRoute = next.route;
    bindSoon(() => next.bindPage());
    return;
  }

  lastShellKey = nextKey;
  lastBoundRoute = next.route;
  container.innerHTML = next.html;
  bindSoon(() => {
    next.bindLayout();
    next.bindPage();
  });
}
