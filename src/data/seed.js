import {
  GERENCIAS, COORDENACOES, REGIONAIS, MUNICIPIOS, EQUIPES,
} from './reference-data.js';
import { getCoordenacoes, getMunicipios, getRegionais } from '../services/catalog-service.js';
import {
  STATUS_PROGRAMACAO, getStatusBadgeClass as statusBadgeClass,
} from '../utils/status.js';

export { GERENCIAS, COORDENACOES, REGIONAIS, MUNICIPIOS, EQUIPES };

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

export { STATUS_PROGRAMACAO };

export function getCoordenacaoById(id) {
  return getCoordenacoes().find((c) => c.id === id) || COORDENACOES.find((c) => c.id === id);
}

export function getGerenciaByProgramacao(p) {
  return getCoordenacaoById(p?.coordenacaoId)?.gerencia || '—';
}

export function getMunicipioById(id) {
  return getMunicipios().find((m) => m.id === id) || MUNICIPIOS.find((m) => m.id === id);
}

export function getRegionalById(id) {
  if (!id) return null;
  return getRegionais().find((r) => r.id === id) || REGIONAIS.find((r) => r.id === id);
}

export function getMunicipiosByRegional(regionalId) {
  const list = getMunicipios();
  if (!regionalId) return list;
  return list.filter((m) => m.regionalId === regionalId);
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
