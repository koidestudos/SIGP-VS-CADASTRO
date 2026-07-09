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

export const EQUIPES = [
  { id: 'e1', nome: 'Ivone Venâncio', cargo: 'Coordenadora', coordenacaoId: 'gas-crianca' },
  { id: 'e2', nome: 'Maria Boa Ventura', cargo: 'Enfermeira', coordenacaoId: 'gas-crianca' },
  { id: 'e3', nome: 'Teodoro Cordela', cargo: 'Técnico', coordenacaoId: 'gas-crianca' },
];
