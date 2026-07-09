import {
  COORDENACOES, GERENCIAS, REGIONAIS, MUNICIPIOS,
  getCoordenacaoById, getGerenciaByProgramacao, getMunicipioById, getRegionalById,
} from '../data/seed.js';
import { normalizeStatus, filterForBI, STATUS_PROGRAMACAO, isInBI } from './status.js';

export { filterForBI as getProgramacoesForBI };

export function countServidores(programacoes) {
  const nomes = new Set();
  programacoes.forEach((p) => {
    if (p.responsavel) nomes.add(p.responsavel.trim());
    (p.equipe || []).forEach((e) => { if (e.nome) nomes.add(e.nome.trim()); });
  });
  return nomes.size;
}

export function countServidoresList(programacoes) {
  const map = new Map();
  programacoes.forEach((p) => {
    const add = (nome, cargo) => {
      if (!nome) return;
      const k = nome.trim();
      if (!map.has(k)) map.set(k, { nome: k, cargo: cargo || '—', count: 0 });
      map.get(k).count += 1;
    };
    add(p.responsavel, 'Responsável');
    (p.equipe || []).forEach((e) => add(e.nome, e.cargo));
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function countByGerencia(programacoes) {
  return GERENCIAS.map((g, i) => ({
    label: g,
    value: programacoes.filter((p) => getGerenciaByProgramacao(p) === g).length,
    color: ['#1351B4', '#168821', '#ca8a04'][i],
  }));
}

export function countByCoordenacao(programacoes) {
  return COORDENACOES.map((c) => ({
    label: c.sigla,
    fullName: c.nome,
    gerencia: c.gerencia,
    value: programacoes.filter((p) => p.coordenacaoId === c.id).length,
  })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
}

export function countByMunicipio(programacoes) {
  const map = new Map();
  programacoes.forEach((p) => {
    if (!p.municipioId) return;
    map.set(p.municipioId, (map.get(p.municipioId) || 0) + 1);
  });
  return [...map.entries()].map(([id, count]) => ({
    id,
    nome: getMunicipioById(id)?.nome || id,
    count,
  })).sort((a, b) => b.count - a.count);
}

export function municipioStats(programacoes, munId) {
  const items = programacoes.filter((p) => p.municipioId === munId);
  const coords = new Set(items.map((p) => p.coordenacaoId).filter(Boolean));
  const dias = new Set();
  items.forEach((p) => {
    if (!p.dataInicial) return;
    const start = new Date(p.dataInicial + 'T12:00:00');
    const end = new Date((p.dataFinal || p.dataInicial) + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dias.add(d.toISOString().slice(0, 10));
    }
  });
  return {
    programacoes: items.length,
    coordenacoes: coords.size,
    servidores: countServidores(items),
    dias: dias.size,
  };
}

export function countByRegional(programacoes) {
  return REGIONAIS.map((r) => {
    const muns = MUNICIPIOS.filter((m) => m.regionalId === r.id);
    const munIds = new Set(muns.map((m) => m.id));
    const items = programacoes.filter((p) => munIds.has(p.municipioId));
    const coords = new Set(items.map((p) => p.coordenacaoId));
    return {
      id: r.id,
      nome: r.nome,
      programacoes: items.length,
      municipios: new Set(items.map((p) => p.municipioId)).size,
      coordenacoes: coords.size,
    };
  }).filter((r) => r.programacoes > 0).sort((a, b) => b.programacoes - a.programacoes);
}

export function countByMonth(programacoes, year = new Date().getFullYear()) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return meses.map((label, i) => ({
    label,
    value: programacoes.filter((p) => {
      const d = new Date(p.dataInicial + 'T12:00:00');
      return d.getFullYear() === year && d.getMonth() === i;
    }).length,
  }));
}

export function countByTipo(programacoes) {
  const map = new Map();
  programacoes.forEach((p) => {
    const t = p.tipoAtividade || 'Não informado';
    map.set(t, (map.get(t) || 0) + 1);
  });
  const colors = ['#1351B4', '#168821', '#ca8a04', '#7c3aed', '#E52207', '#0d9488'];
  return [...map.entries()].map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
    .sort((a, b) => b.value - a.value);
}

const PUBLICO_RULES = [
  ['escola', 'Escolas'], ['creche', 'Escolas'], ['unidade de saúde', 'Unidades de Saúde'],
  ['ubs', 'Unidades de Saúde'], ['hospital', 'Hospitais'], ['comunidade', 'Comunidade'],
  ['servidor', 'Servidores'], ['população', 'População geral'],
];

export function countByPublico(programacoes) {
  const map = new Map();
  programacoes.forEach((p) => {
    const text = (p.publicoAlvo || '').toLowerCase();
    let matched = false;
    for (const [kw, cat] of PUBLICO_RULES) {
      if (text.includes(kw)) {
        map.set(cat, (map.get(cat) || 0) + 1);
        matched = true;
      }
    }
    if (!matched && text) map.set('Outros', (map.get('Outros') || 0) + 1);
    else if (!text) map.set('Não informado', (map.get('Não informado') || 0) + 1);
  });
  const colors = ['#1351B4', '#168821', '#ca8a04', '#7c3aed', '#E52207', '#0d9488', '#64748b', '#94a3b8'];
  return [...map.entries()].map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
    .sort((a, b) => b.value - a.value);
}

export function countByStatus(programacoes) {
  const labels = {
    Autorizada: { label: 'Autorizadas', color: '#168821' },
    'Em execução': { label: 'Em execução', color: '#1351B4' },
    Realizada: { label: 'Realizadas', color: '#0d9488' },
    'Em análise': { label: 'Em análise', color: '#ca8a04' },
    'Enviada para Gerência': { label: 'Enviadas', color: '#6366f1' },
    Rascunho: { label: 'Rascunhos', color: '#6C757D' },
    Cancelada: { label: 'Canceladas', color: '#E52207' },
    Reprovada: { label: 'Reprovadas', color: '#dc2626' },
  };
  const counts = Object.fromEntries(STATUS_PROGRAMACAO.map((s) => [s, 0]));
  programacoes.forEach((p) => {
    const s = normalizeStatus(p.status);
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return Object.entries(labels).map(([status, meta]) => ({
    status,
    label: meta.label,
    value: counts[status] || 0,
    color: meta.color,
  })).filter((s) => s.value > 0);
}

export function countByDay(programacoes) {
  const map = new Map();
  programacoes.forEach((p) => {
    if (!p.dataInicial) return;
    const start = new Date(p.dataInicial + 'T12:00:00');
    const end = new Date((p.dataFinal || p.dataInicial) + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    }
  });
  return map;
}

export function logisticaStats(programacoes) {
  const transporte = programacoes.filter((p) => p.necessitaTransporte);
  const alimentacao = programacoes.filter((p) => p.necessitaAlimentacao);
  return { transporte, alimentacao };
}

export function countByCargo(programacoes) {
  const map = new Map();
  programacoes.forEach((p) => {
    (p.equipe || []).forEach((e) => {
      const c = e.cargo || 'Não informado';
      map.set(c, (map.get(c) || 0) + 1);
    });
  });
  return [...map.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 10);
}

export function proximasAcoes(programacoes) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const upcoming = programacoes
    .filter((p) => isInBI(p.status))
    .filter((p) => !['Realizada', 'Cancelada', 'Reprovada'].includes(normalizeStatus(p.status)))
    .sort((a, b) => a.dataInicial.localeCompare(b.dataInicial));

  const toDate = (s) => new Date(s + 'T12:00:00');

  return {
    hoje: upcoming.filter((p) => toDate(p.dataInicial) <= today && toDate(p.dataFinal || p.dataInicial) >= today),
    amanha: upcoming.filter((p) => {
      const d = toDate(p.dataInicial);
      return d.getTime() === tomorrow.getTime();
    }),
    semana: upcoming.filter((p) => {
      const d = toDate(p.dataInicial);
      return d > tomorrow && d <= weekEnd;
    }),
  };
}

export { getCoordenacaoById, getGerenciaByProgramacao, getMunicipioById, getRegionalById };
