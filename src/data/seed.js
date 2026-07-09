import geo from './regions-municipios.json';

export const GERENCIAS = ['GAS', 'GAP', 'GVS'];

export const COORDENACOES = [
  { id: 'gas-idoso', nome: 'Coordenação de Atenção à Saúde do Idoso', gerencia: 'GAS', sigla: 'CASI' },
  { id: 'gas-mulher', nome: 'Coordenação à Saúde da Mulher', gerencia: 'GAS', sigla: 'CASM' },
  { id: 'gas-crianca', nome: 'Coordenação de Atenção à Saúde da Criança e Adolescente', gerencia: 'GAS', sigla: 'CASCA' },
  { id: 'gas-dt', nome: 'Coordenação de Doenças Transmissíveis', gerencia: 'GAS', sigla: 'CDT' },
  { id: 'gas-pcd', nome: 'Coordenação de Atenção à Pessoa com Deficiência', gerencia: 'GAS', sigla: 'CAPCD' },
  { id: 'gas-equidade', nome: 'Coordenação de Equidade', gerencia: 'GAS', sigla: 'CEQ' },
  { id: 'gas-cta', nome: 'CTA', gerencia: 'GAS', sigla: 'CTA' },
  { id: 'gap-bucal', nome: 'Coordenação de Saúde Bucal', gerencia: 'GAP', sigla: 'CSB' },
  { id: 'gap-aps', nome: 'Coordenação de Atenção Primária', gerencia: 'GAP', sigla: 'CAPS' },
  { id: 'gvs-epi', nome: 'Coordenação de Epidemiologia', gerencia: 'GVS', sigla: 'CEPI' },
  { id: 'gvs-analise', nome: 'Coordenação de Análise', gerencia: 'GVS', sigla: 'CAN' },
  { id: 'gvs-cvsa', nome: 'Coordenação de Vigilância em Saúde Ambiental - CVSA', gerencia: 'GVS', sigla: 'CVSA' },
  { id: 'gvs-pvt', nome: 'Equipe PVT', gerencia: 'GVS', sigla: 'PVT' },
  { id: 'gvs-imuno', nome: 'Coordenação de Imunização', gerencia: 'GVS', sigla: 'CIM' },
];

export const REGIONAIS = geo.regions;
export const MUNICIPIOS = geo.municipios;

export const GERENCIA_COLORS = {
  GAS: { bg: '#dbeafe', border: '#1351B4', text: '#1351B4' },
  GAP: { bg: '#dcfce7', border: '#168821', text: '#168821' },
  GVS: { bg: '#fef9c3', border: '#ca8a04', text: '#a16207' },
  DUVAS: { bg: '#f3e8ff', border: '#7c3aed', text: '#7c3aed' },
};

export const TIPOS_ATIVIDADE = [
  'Visita técnica', 'Capacitação', 'Reunião de planejamento', 'Ação de campo',
  'Supervisão', 'Investigação epidemiológica', 'Campanha de vacinação',
  'Auditoria', 'Palestra / Oficina', 'Monitoramento',
];

export const STATUS_PROGRAMACAO = [
  'Rascunho', 'Pendente', 'Aprovada', 'Publicada', 'Concluída', 'Cancelada',
];

export const EQUIPES = [
  { id: 'e1', nome: 'Ivone Venâncio', cargo: 'Coordenadora', coordenacaoId: 'gas-crianca' },
  { id: 'e2', nome: 'Maria Boa Ventura', cargo: 'Enfermeira', coordenacaoId: 'gas-crianca' },
  { id: 'e3', nome: 'Teodoro Cordela', cargo: 'Técnico', coordenacaoId: 'gas-crianca' },
];


export function getCoordenacaoById(id) {
  return COORDENACOES.find((c) => c.id === id);
}

export function getGerenciaByProgramacao(p) {
  return getCoordenacaoById(p?.coordenacaoId)?.gerencia || '—';
}

export function getMunicipioById(id) {
  return MUNICIPIOS.find((m) => m.id === id);
}

export function getRegionalById(id) {
  if (!id) return null;
  return REGIONAIS.find((r) => r.id === id);
}

export function getMunicipiosByRegional(regionalId) {
  if (!regionalId) return MUNICIPIOS;
  return MUNICIPIOS.filter((m) => m.regionalId === regionalId);
}

export function getStatusBadgeClass(status) {
  const map = {
    Rascunho: 'badge-rascunho', Pendente: 'badge-pendente', Aprovada: 'badge-aprovada',
    Publicada: 'badge-publicada', Concluída: 'badge-concluida', Cancelada: 'badge-cancelada',
    Solicitado: 'badge-solicitado', Confirmado: 'badge-confirmado',
  };
  return map[status] || 'badge-rascunho';
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getGerenciaColor(gerencia) {
  return GERENCIA_COLORS[gerencia] || GERENCIA_COLORS.DUVAS;
}

export function shortTitle(titulo, max = 22) {
  if (!titulo) return '';
  return titulo.length > max ? `${titulo.slice(0, max)}…` : titulo;
}
