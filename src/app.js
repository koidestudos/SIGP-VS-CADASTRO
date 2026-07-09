import { renderAppShell, bindLayoutEvents, breadcrumbHtml, refreshNotificationBadge } from './components/layout.js';
import { logoutUser } from './services/auth.js';
import { renderDashboard, bindDashboard } from './pages/dashboard.js';
import { renderProgramacoes, bindProgramacoes } from './pages/programacoes.js';
import { renderNovaProgramacao, bindNovaProgramacao } from './pages/nova-programacao.js';
import { renderCalendario, bindCalendario } from './pages/calendario.js';
import { renderCoordenacoes, bindCoordenacoes } from './pages/coordenacoes.js';
import { renderMunicipios, bindMunicipios } from './pages/municipios.js';
import { renderLogistica, bindLogistica } from './pages/logistica.js';
import { renderEquipes, bindEquipes } from './pages/equipes.js';
import { renderBiGerencial, bindBiGerencial } from './pages/bi-gerencial.js';
import { renderAdministracao, bindAdministracao } from './pages/administracao.js';
import { canViewBI } from './services/roles.js';

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
  administracao: { title: 'Administração', render: renderAdministracao, bind: bindAdministracao },
};

export function renderApp(user, route, params) {
  if ((route === 'bi-gerencial' || route === 'administracao') && !canViewBI(user)) {
    route = 'dashboard';
  }
  const page = PAGE_META[route] || PAGE_META.dashboard;
  const content = page.render(user, params);
  const breadcrumb = page.breadcrumb ? page.breadcrumb() : (params.length ? params.join(' / ') : '');
  const html = renderAppShell(user, route, page.title, content, breadcrumb);

  setTimeout(() => {
    bindLayoutEvents(
      (r) => { window.location.hash = r; },
      async () => { await logoutUser(); window.location.hash = 'login'; },
      user,
    );
    page.bind?.(user, params);
  }, 0);

  return html;
}
