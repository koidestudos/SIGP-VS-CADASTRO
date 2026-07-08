import { renderAppShell, bindLayoutEvents } from './components/layout.js';
import { clearAuth } from './services/storage.js';
import { renderDashboard, bindDashboard } from './pages/dashboard.js';
import { renderProgramacoes, bindProgramacoes } from './pages/programacoes.js';
import { renderNovaProgramacao, bindNovaProgramacao } from './pages/nova-programacao.js';
import { renderCalendario, bindCalendario } from './pages/calendario.js';
import { renderCoordenacoes, bindCoordenacoes } from './pages/coordenacoes.js';
import { renderMunicipios, bindMunicipios } from './pages/municipios.js';
import { renderLogistica, bindLogistica } from './pages/logistica.js';
import { renderEquipes, bindEquipes } from './pages/equipes.js';
import { renderRelatorios, bindRelatorios } from './pages/relatorios.js';
import { renderDocumentos, bindDocumentos } from './pages/documentos.js';
import { renderAdministracao, bindAdministracao } from './pages/administracao.js';

const PAGE_META = {
  dashboard: { title: 'Dashboard', render: renderDashboard, bind: bindDashboard },
  programacoes: { title: 'Programações', render: renderProgramacoes, bind: bindProgramacoes },
  'nova-programacao': { title: 'Nova Programação', render: renderNovaProgramacao, bind: bindNovaProgramacao },
  calendario: { title: 'Calendário', render: renderCalendario, bind: bindCalendario },
  coordenacoes: { title: 'Coordenações', render: renderCoordenacoes, bind: bindCoordenacoes },
  municipios: { title: 'Municípios', render: renderMunicipios, bind: bindMunicipios },
  logistica: { title: 'Logística', render: renderLogistica, bind: bindLogistica },
  equipes: { title: 'Equipes', render: renderEquipes, bind: bindEquipes },
  relatorios: { title: 'Relatórios', render: renderRelatorios, bind: bindRelatorios },
  documentos: { title: 'Documentos', render: renderDocumentos, bind: bindDocumentos },
  administracao: { title: 'Administração', render: renderAdministracao, bind: bindAdministracao },
};

const SUB_ROUTE_PAGES = ['coordenacoes', 'municipios', 'nova-programacao'];

export function renderApp(user, route, params) {
  const baseRoute = SUB_ROUTE_PAGES.includes(route) ? route : route;
  const page = PAGE_META[baseRoute] || PAGE_META.dashboard;
  const content = page.render(user, params);
  const breadcrumb = params.length ? decodeURIComponent(params.join(' / ')) : '';
  const html = renderAppShell(user, baseRoute, page.title, content, breadcrumb);

  setTimeout(() => {
    bindLayoutEvents(
      (r) => { window.location.hash = r; },
      () => { clearAuth(); window.location.hash = 'login'; }
    );
    page.bind?.(user, params);
  }, 0);

  return html;
}
