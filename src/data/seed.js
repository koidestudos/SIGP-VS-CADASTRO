import {
  GERENCIAS, COORDENACOES, REGIONAIS, MUNICIPIOS, EQUIPES,
} from './reference-data.js';
import { getCoordenacoes, getMunicipios, getRegionais } from '../services/catalog-service.js';
import {
  STATUS_PROGRAMACAO, getStatusBadgeClass as statusBadgeClass,
} from '../utils/status.js';

export { GERENCIAS, COORDENACOES, REGIONAIS, MUNICIPIOS, EQUIPES };

/** Município virtual para locais fora do Piauí */
export const MUNICIPIO_OUTROS_ID = 'mun-outros';

export const GERENCIA_COLORS = {
  GAS: { bg: '#dbeafe', border: '#1351B4', text: '#1351B4' },
  GAP: { bg: '#dcfce7', border: '#168821', text: '#168821' },
  GVS: { bg: '#fef9c3', border: '#ca8a04', text: '#a16207' },
  DUVAS: { bg: '#f3e8ff', border: '#7c3aed', text: '#7c3aed' },
};

export const TIPOS_ATIVIDADE = [
  'Visita técnica', 'Capacitação', 'Reunião de planejamento', 'Reunião virtual',
  'Qualificação', 'Ação de campo', 'Supervisão', 'Investigação epidemiológica',
  'Campanha de vacinação', 'Auditoria', 'Palestra / Oficina', 'Monitoramento', 'Outros',
];

export { STATUS_PROGRAMACAO };

export function getCoordenacaoById(id) {
  return getCoordenacoes().find((c) => c.id === id) || COORDENACOES.find((c) => c.id === id);
}

export function getGerenciaByProgramacao(p) {
  return getCoordenacaoById(p?.coordenacaoId)?.gerencia || '—';
}

export function getMunicipioById(id) {
  if (!id) return null;
  if (id === MUNICIPIO_OUTROS_ID) {
    return { id: MUNICIPIO_OUTROS_ID, nome: 'Outros (fora do Piauí)', regionalId: '' };
  }
  if (String(id).startsWith('outros:')) {
    let nome = String(id).slice(7);
    try { nome = decodeURIComponent(nome); } catch { /* keep raw */ }
    return { id, nome: nome ? `${nome} (fora do Piauí)` : 'Outros (fora do Piauí)', regionalId: '' };
  }
  return getMunicipios().find((m) => m.id === id) || MUNICIPIOS.find((m) => m.id === id);
}

export function getMunicipioIdsFromProgramacao(p) {
  if (Array.isArray(p?.municipioIds) && p.municipioIds.length) {
    return p.municipioIds.filter(Boolean);
  }
  if (p?.municipioId) return [p.municipioId];
  return [];
}

export function getMunicipiosFromProgramacao(p) {
  return getMunicipioIdsFromProgramacao(p).map((id) => getMunicipioById(id)).filter(Boolean);
}

export function getMunicipiosLabel(p, separator = ', ') {
  const names = getMunicipioIdsFromProgramacao(p).map((id) => getMunicipioById(id)?.nome || id);
  return names.length ? names.join(separator) : '—';
}

export function programacaoHasMunicipio(p, munId) {
  return munId && getMunicipioIdsFromProgramacao(p).includes(munId);
}

export function countUniqueMunicipios(programacoes) {
  const set = new Set();
  programacoes.forEach((p) => {
    getMunicipioIdsFromProgramacao(p).forEach((id) => set.add(id));
  });
  return set.size;
}

export function forEachProgramacaoMunicipio(programacoes, fn) {
  programacoes.forEach((p) => {
    getMunicipioIdsFromProgramacao(p).forEach((munId) => fn(p, munId));
  });
}

export function getRegionalById(id) {
  if (!id) return null;
  return getRegionais().find((r) => r.id === id) || REGIONAIS.find((r) => r.id === id);
}

export function getRegionalIdsFromProgramacao(p) {
  if (Array.isArray(p?.regionalIds) && p.regionalIds.length) {
    return p.regionalIds.filter(Boolean);
  }
  if (p?.regionalId) return [p.regionalId];
  return [];
}

export function getRegionaisLabel(p, separator = ', ') {
  const names = getRegionalIdsFromProgramacao(p)
    .map((id) => getRegionalById(id)?.nome)
    .filter(Boolean);
  return names.length ? names.join(separator) : 'Não informada';
}

export function getMunicipiosByRegional(regionalId) {
  const list = getMunicipios();
  if (!regionalId) return list;
  return list.filter((m) => m.regionalId === regionalId);
}

export function getMunicipiosByRegionais(regionalIds = []) {
  const list = getMunicipios();
  const ids = (regionalIds || []).filter(Boolean);
  if (!ids.length) return list;
  const set = new Set(ids);
  return list.filter((m) => set.has(m.regionalId));
}

export function getStatusBadgeClass(status) {
  return statusBadgeClass(status);
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
