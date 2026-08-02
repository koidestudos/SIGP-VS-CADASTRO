import * as XLSX from 'xlsx';
import {
  formatDate, getCoordenacaoById, getGerenciaByProgramacao, getMunicipiosLabel,
} from '../data/seed.js';
import { normalizeStatus } from './status.js';

/**
 * Gera e baixa relatório .xlsx das programações filtradas (nomes sem corte).
 */
export function downloadProgramacoesListXlsx(items, { title = 'Relatório de Programações', subtitle = '' } = {}) {
  if (!items.length) throw new Error('Nenhuma programação no filtro atual.');

  const rows = items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const equipe = (p.equipe || []).map((e) => e.nome).filter(Boolean).join(', ') || p.responsavel || '';
    return {
      Ação: p.titulo || '',
      Gerência: getGerenciaByProgramacao(p),
      Coordenação: coord?.nome || '',
      Município: getMunicipiosLabel(p),
      'Data Ida': formatDate(p.dataInicial),
      'Data Volta': formatDate(p.dataFinal),
      Status: normalizeStatus(p.status),
      Equipe: equipe,
      'Código orçamentário': p.codigoOrcamentario || '',
      'Código da Fonte': p.fonteRecurso || '',
      Observações: p.observacoes || '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Larguras generosas para nomes longos não parecerem cortados no Excel
  ws['!cols'] = [
    { wch: 45 }, // Ação
    { wch: 10 }, // Gerência
    { wch: 40 }, // Coordenação
    { wch: 35 }, // Município
    { wch: 12 }, // Ida
    { wch: 12 }, // Volta
    { wch: 22 }, // Status
    { wch: 45 }, // Equipe
    { wch: 28 }, // Código orçamentário
    { wch: 28 }, // Fonte
    { wch: 40 }, // Observações
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Programações');

  const meta = XLSX.utils.aoa_to_sheet([
    ['SIGP-VS — Relatório de Programações'],
    [title],
    [subtitle || ''],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [`Total: ${items.length} registro(s)`],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Info');

  const safe = String(title).replace(/[^\w\-]+/g, '-').slice(0, 40) || 'filtro';
  XLSX.writeFile(wb, `sigp-vs-programacoes-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
