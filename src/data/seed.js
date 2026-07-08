export const GERENCIAS = ['GAS', 'GAP', 'GVS'];

export const COORDENACOES = [
  { id: 'gas-idoso', nome: 'Coordenação de Atenção à Saúde do Idoso', gerencia: 'GAS', sigla: 'CASI' },
  { id: 'gas-mulher', nome: 'Coordenação de Atenção à Saúde da Mulher', gerencia: 'GAS', sigla: 'CASM' },
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

export const REGIONAIS = [
  { id: 'r1', nome: 'Região Metropolana de Teresina' },
  { id: 'r2', nome: 'Região Centro-Norte' },
  { id: 'r3', nome: 'Região Sudoeste' },
  { id: 'r4', nome: 'Região Vale do Rio Canindé' },
  { id: 'r5', nome: 'Região Vale do Sambito' },
  { id: 'r6', nome: 'Região Planície Litorânea' },
  { id: 'r7', nome: 'Região Cocais' },
  { id: 'r8', nome: 'Região Chapada das Mangabeiras' },
  { id: 'r9', nome: 'Região Entre Rios' },
  { id: 'r10', nome: 'Região Vale do Rio Guaribas' },
  { id: 'r11', nome: 'Região Semiárido' },
  { id: 'r12', nome: 'Região Tabuleiros do Alto Parnaíba' },
];

export const MUNICIPIOS = [
  { id: 'm1', nome: 'Teresina', regionalId: 'r1', coordenacaoId: 'gas-crianca' },
  { id: 'm2', nome: 'São Raimundo Nonato', regionalId: 'r3', coordenacaoId: 'gvs-epi' },
  { id: 'm3', nome: 'Pedro II', regionalId: 'r4', coordenacaoId: 'gas-dt' },
  { id: 'm4', nome: 'Picos', regionalId: 'r5', coordenacaoId: 'gvs-imuno' },
  { id: 'm5', nome: 'Parnaíba', regionalId: 'r6', coordenacaoId: 'gap-bucal' },
  { id: 'm6', nome: 'Floriano', regionalId: 'r10', coordenacaoId: 'gas-mulher' },
  { id: 'm7', nome: 'Piripiri', regionalId: 'r2', coordenacaoId: 'gvs-cvsa' },
  { id: 'm8', nome: 'Campo Maior', regionalId: 'r2', coordenacaoId: 'gap-aps' },
  { id: 'm9', nome: 'Oeiras', regionalId: 'r9', coordenacaoId: 'gas-idoso' },
  { id: 'm10', nome: 'Bom Jesus', regionalId: 'r8', coordenacaoId: 'gvs-analise' },
];

export const TIPOS_ATIVIDADE = [
  'Visita técnica',
  'Capacitação',
  'Reunião de planejamento',
  'Ação de campo',
  'Supervisão',
  'Investigação epidemiológica',
  'Campanha de vacinação',
  'Auditoria',
  'Palestra / Oficina',
  'Monitoramento',
];

export const STATUS_PROGRAMACAO = [
  'Rascunho',
  'Pendente',
  'Aprovada',
  'Publicada',
  'Concluída',
  'Cancelada',
];

export const PERFIS = ['Administrador', 'Gerência', 'Consulta'];

export const USUARIOS = [
  { id: 'u1', nome: 'Administrador SIGP', cpf: '00000000000', senha: 'admin123', perfil: 'Administrador', coordenacaoId: null },
  { id: 'u2', nome: 'Ivone Venâncio', cpf: '12345678901', senha: 'gerencia1', perfil: 'Gerência', coordenacaoId: 'gas-crianca' },
  { id: 'u3', nome: 'Maria Boa Ventura', cpf: '98765432100', senha: 'gerencia2', perfil: 'Gerência', coordenacaoId: 'gvs-epi' },
  { id: 'u4', nome: 'Teodoro Cordela', cpf: '11122233344', senha: 'consulta1', perfil: 'Consulta', coordenacaoId: null },
];

export const EQUIPES = [
  { id: 'e1', nome: 'Ivone Venâncio', cargo: 'Coordenadora', coordenacaoId: 'gas-crianca' },
  { id: 'e2', nome: 'Maria Boa Ventura', cargo: 'Enfermeira', coordenacaoId: 'gas-crianca' },
  { id: 'e3', nome: 'Teodoro Cordela', cargo: 'Técnico', coordenacaoId: 'gas-crianca' },
  { id: 'e4', nome: 'Ana Paula Silva', cargo: 'Médica', coordenacaoId: 'gvs-epi' },
  { id: 'e5', nome: 'Carlos Mendes', cargo: 'Epidemiologista', coordenacaoId: 'gvs-epi' },
  { id: 'e6', nome: 'Fernanda Lima', cargo: 'Nutricionista', coordenacaoId: 'gap-bucal' },
  { id: 'e7', nome: 'Roberto Alves', cargo: 'Motorista', coordenacaoId: null },
  { id: 'e8', nome: 'Juliana Santos', cargo: 'Assistente Administrativo', coordenacaoId: 'gas-dt' },
];

function makeDate(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
}

export const PROGRAMACOES = [
  {
    id: 'p1',
    titulo: 'Supervisão APS — Criança e Adolescente',
    tipoAtividade: 'Supervisão',
    coordenacaoId: 'gas-crianca',
    responsavel: 'Ivone Venâncio',
    objetivo: 'Avaliar indicadores de saúde da criança na atenção primária',
    publicoAlvo: 'Profissionais de saúde da APS',
    semana: '1ª Semana',
    dataInicial: makeDate(3),
    dataFinal: makeDate(5),
    duracao: '3 dias',
    regionalId: 'r3',
    municipioId: 'm2',
    localAtividade: 'Secretaria Municipal de Saúde',
    necessitaTransporte: true,
    necessitaAlimentacao: true,
    obsLogistica: 'Veículo oficial — 2 motoristas',
    equipe: [
      { nome: 'Ivone Venâncio', cargo: 'Coordenadora' },
      { nome: 'Maria Boa Ventura', cargo: 'Enfermeira' },
    ],
    codigoOrcamentario: '2026.001.0045',
    fonteRecurso: 'Fundo Estadual de Saúde',
    observacoes: 'Levar material educativo',
    documentos: [],
    status: 'Publicada',
    criadoPor: 'u2',
    criadoEm: makeDate(-10),
  },
  {
    id: 'p2',
    titulo: 'Investigação de surto — Arboviroses',
    tipoAtividade: 'Investigação epidemiológica',
    coordenacaoId: 'gvs-epi',
    responsavel: 'Maria Boa Ventura',
    objetivo: 'Investigar casos suspeitos de dengue',
    publicoAlvo: 'Equipe de vigilância epidemiológica',
    semana: '2ª Semana',
    dataInicial: makeDate(8),
    dataFinal: makeDate(10),
    duracao: '3 dias',
    regionalId: 'r4',
    municipioId: 'm3',
    localAtividade: 'Unidade Básica de Saúde Central',
    necessitaTransporte: true,
    necessitaAlimentacao: false,
    obsLogistica: '',
    equipe: [
      { nome: 'Maria Boa Ventura', cargo: 'Enfermeira' },
      { nome: 'Carlos Mendes', cargo: 'Epidemiologista' },
    ],
    codigoOrcamentario: '2026.002.0089',
    fonteRecurso: 'Fundo Nacional de Saúde',
    observacoes: '',
    documentos: [],
    status: 'Aprovada',
    criadoPor: 'u3',
    criadoEm: makeDate(-5),
  },
  {
    id: 'p3',
    titulo: 'Campanha de vacinação — Influenza',
    tipoAtividade: 'Campanha de vacinação',
    coordenacaoId: 'gvs-imuno',
    responsavel: 'Ana Paula Silva',
    objetivo: 'Ampliar cobertura vacinal contra influenza',
    publicoAlvo: 'Idosos e grupos prioritários',
    semana: '3ª Semana',
    dataInicial: makeDate(15),
    dataFinal: makeDate(17),
    duracao: '3 dias',
    regionalId: 'r5',
    municipioId: 'm4',
    localAtividade: 'Posto de Saúde Central',
    necessitaTransporte: true,
    necessitaAlimentacao: true,
    obsLogistica: 'Transporte de insumos refrigerados',
    equipe: [{ nome: 'Ana Paula Silva', cargo: 'Médica' }],
    codigoOrcamentario: '2026.003.0120',
    fonteRecurso: 'Fundo Estadual de Saúde',
    observacoes: 'Verificar cadeia de frio',
    documentos: [],
    status: 'Pendente',
    criadoPor: 'u3',
    criadoEm: makeDate(-2),
  },
  {
    id: 'p4',
    titulo: 'Capacitação — Saúde Bucal na APS',
    tipoAtividade: 'Capacitação',
    coordenacaoId: 'gap-bucal',
    responsavel: 'Fernanda Lima',
    objetivo: 'Capacitar equipes sobre procedimentos odontológicos na APS',
    publicoAlvo: 'Cirurgiões-dentistas e técnicos',
    semana: '4ª Semana',
    dataInicial: makeDate(22),
    dataFinal: makeDate(23),
    duracao: '2 dias',
    regionalId: 'r6',
    municipioId: 'm5',
    localAtividade: 'Auditório da SMS',
    necessitaTransporte: false,
    necessitaAlimentacao: true,
    obsLogistica: 'Coffee break incluso',
    equipe: [{ nome: 'Fernanda Lima', cargo: 'Nutricionista' }],
    codigoOrcamentario: '',
    fonteRecurso: 'Recursos próprios',
    observacoes: '',
    documentos: [],
    status: 'Rascunho',
    criadoPor: 'u2',
    criadoEm: makeDate(-1),
  },
  {
    id: 'p5',
    titulo: 'Monitoramento — Tuberculose',
    tipoAtividade: 'Monitoramento',
    coordenacaoId: 'gas-dt',
    responsavel: 'Juliana Santos',
    objetivo: 'Monitorar indicadores de controle da tuberculose',
    publicoAlvo: 'Equipe de controle de TB',
    semana: '1ª Semana',
    dataInicial: makeDate(-7),
    dataFinal: makeDate(-5),
    duracao: '3 dias',
    regionalId: 'r4',
    municipioId: 'm3',
    localAtividade: 'Centro de Referência',
    necessitaTransporte: true,
    necessitaAlimentacao: false,
    obsLogistica: '',
    equipe: [{ nome: 'Juliana Santos', cargo: 'Assistente Administrativo' }],
    codigoOrcamentario: '2026.001.0067',
    fonteRecurso: 'Fundo Estadual de Saúde',
    observacoes: '',
    documentos: [],
    status: 'Concluída',
    criadoPor: 'u2',
    criadoEm: makeDate(-20),
  },
];

export const LOGISTICA = [
  { id: 'l1', programacaoId: 'p1', municipioId: 'm2', transporte: true, alimentacao: true, situacao: 'Solicitado' },
  { id: 'l2', programacaoId: 'p2', municipioId: 'm3', transporte: true, alimentacao: false, situacao: 'Confirmado' },
  { id: 'l3', programacaoId: 'p3', municipioId: 'm4', transporte: true, alimentacao: true, situacao: 'Solicitado' },
  { id: 'l4', programacaoId: 'p5', municipioId: 'm3', transporte: true, alimentacao: false, situacao: 'Confirmado' },
];

export function getCoordenacaoById(id) {
  return COORDENACOES.find((c) => c.id === id);
}

export function getMunicipioById(id) {
  return MUNICIPIOS.find((m) => m.id === id);
}

export function getRegionalById(id) {
  return REGIONAIS.find((r) => r.id === id);
}

export function getStatusBadgeClass(status) {
  const map = {
    Rascunho: 'badge-rascunho',
    Pendente: 'badge-pendente',
    Aprovada: 'badge-aprovada',
    Publicada: 'badge-publicada',
    Concluída: 'badge-concluida',
    Cancelada: 'badge-cancelada',
    Solicitado: 'badge-solicitado',
    Confirmado: 'badge-confirmado',
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
