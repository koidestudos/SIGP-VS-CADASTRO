import {
  formatDate, getCoordenacaoById, getGerenciaByProgramacao, getMunicipiosLabel,
} from '../data/seed.js';
import { normalizeStatus } from './status.js';

const HEADERS = [
  'Ação',
  'Gerência',
  'Coordenação',
  'Município',
  'Data Ida',
  'Data Volta',
  'Status',
  'Equipe',
  'Código orçamentário',
  'Código da Fonte',
  'Observações',
];

const COL_WIDTHS = [52, 11, 32, 28, 12, 12, 16, 36, 22, 20, 36];

const COLORS = {
  brandDark: 'FF0C326F',
  brand: 'FF1351B4',
  brandSoft: 'FFE8F0FE',
  white: 'FFFFFFFF',
  text: 'FF212529',
  muted: 'FF495057',
  zebra: 'FFF8F9FA',
  line: 'FFDEE2E6',
  gasBg: 'FFDBEAFE',
  gasFg: 'FF0C326F',
  gapBg: 'FFDCFCE7',
  gapFg: 'FF166534',
  gvsBg: 'FFFEF9C3',
  gvsFg: 'FF854D0E',
  status: {
    Rascunho: { bg: 'FFF1F3F5', fg: 'FF495057' },
    Enviada: { bg: 'FFFEF9C3', fg: 'FF854D0E' },
    Programada: { bg: 'FFDBEAFE', fg: 'FF1351B4' },
    Priorizada: { bg: 'FFFFEDD5', fg: 'FFC2410C' },
    Autorizada: { bg: 'FFBBF7D0', fg: 'FF166534' },
    'Em execução': { bg: 'FFCCFBF1', fg: 'FF0F766E' },
    Realizada: { bg: 'FFDCFCE7', fg: 'FF166534' },
    Cancelada: { bg: 'FFFECACA', fg: 'FFB91C1C' },
    Reprovada: { bg: 'FFFECACA', fg: 'FFB91C1C' },
  },
};

function gerenciaStyle(ger) {
  const g = String(ger || '').toUpperCase();
  if (g === 'GAS') return { bg: COLORS.gasBg, fg: COLORS.gasFg };
  if (g === 'GAP') return { bg: COLORS.gapBg, fg: COLORS.gapFg };
  if (g === 'GVS') return { bg: COLORS.gvsBg, fg: COLORS.gvsFg };
  return { bg: COLORS.brandSoft, fg: COLORS.brand };
}

function thinBorder() {
  const edge = { style: 'thin', color: { argb: COLORS.line } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function paintRow(row, { fill, font, align, border } = {}) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    if (font) cell.font = { ...cell.font, ...font };
    if (align) cell.alignment = { ...cell.alignment, ...align };
    if (border) cell.border = border;
  });
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Gera e baixa relatório .xlsx decorado das programações filtradas.
 */
export async function downloadProgramacoesListXlsx(items, { title = 'Relatório de Programações', subtitle = '' } = {}) {
  if (!items.length) throw new Error('Nenhuma programação no filtro atual.');

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIGP-VS';
  wb.lastModifiedBy = 'SIGP-VS';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Programações', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  });

  ws.columns = COL_WIDTHS.map((width) => ({ width }));

  const lastCol = HEADERS.length;

  // Faixa de título
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'SIGP-VS — Relatório de Programações';
  titleCell.font = { bold: true, size: 16, color: { argb: COLORS.white }, name: 'Calibri' };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 32;
  paintRow(ws.getRow(1), { fill: COLORS.brandDark });

  // Subtítulo / filtro
  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = title + (subtitle ? `  ·  ${subtitle}` : '');
  subCell.font = { size: 11, color: { argb: COLORS.brandDark }, name: 'Calibri', bold: true };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  ws.getRow(2).height = 22;
  paintRow(ws.getRow(2), { fill: COLORS.brandSoft });

  // Meta
  ws.mergeCells(3, 1, 3, lastCol);
  const metaCell = ws.getCell(3, 1);
  metaCell.value = `Gerado em ${new Date().toLocaleString('pt-BR')}   ·   ${items.length} registro(s)`;
  metaCell.font = { size: 10, color: { argb: COLORS.muted }, name: 'Calibri', italic: true };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(3).height = 18;
  paintRow(ws.getRow(3), { fill: COLORS.white });

  // Cabeçalho das colunas
  const headerRow = ws.getRow(4);
  HEADERS.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 24;

  // Dados
  items.forEach((p, idx) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const equipe = (p.equipe || []).map((e) => e.nome).filter(Boolean).join(', ') || p.responsavel || '';
    const ger = getGerenciaByProgramacao(p);
    const status = normalizeStatus(p.status);
    const values = [
      p.titulo || '',
      ger,
      coord?.nome || '',
      getMunicipiosLabel(p),
      formatDate(p.dataInicial),
      formatDate(p.dataFinal),
      status,
      equipe,
      p.codigoOrcamentario || '',
      p.fonteRecurso || '',
      p.observacoes || '',
    ];

    const row = ws.addRow(values);
    const zebra = idx % 2 === 1;
    const tituloLen = String(values[0]).length;
    row.height = Math.min(60, Math.max(22, 14 + Math.ceil(tituloLen / 48) * 12));

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const wrap = col === 1 || col === 3 || col === 4 || col === 8 || col === 11;
      cell.font = { size: 10, name: 'Calibri', color: { argb: COLORS.text } };
      cell.alignment = {
        vertical: 'top',
        horizontal: col === 2 || col === 5 || col === 6 || col === 7 ? 'center' : 'left',
        wrapText: wrap,
      };
      cell.border = thinBorder();
      if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
      }
    });

    const gerStyle = gerenciaStyle(ger);
    const gerCell = row.getCell(2);
    gerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gerStyle.bg } };
    gerCell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: gerStyle.fg } };
    gerCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const st = COLORS.status[status];
    if (st) {
      const stCell = row.getCell(7);
      stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.bg } };
      stCell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: st.fg } };
      stCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
  });

  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + items.length, column: lastCol },
  };

  // Aba resumo
  const info = wb.addWorksheet('Resumo', {
    properties: { defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  info.columns = [{ width: 28 }, { width: 55 }];
  info.mergeCells('A1:B1');
  info.getCell('A1').value = 'SIGP-VS';
  info.getCell('A1').font = { bold: true, size: 14, color: { argb: COLORS.white } };
  info.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandDark } };
  info.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  info.getRow(1).height = 28;

  const infoRows = [
    ['Relatório', title],
    ['Filtros', subtitle || '—'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Total de registros', items.length],
    ['Gerências no filtro', [...new Set(items.map((p) => getGerenciaByProgramacao(p)))].join(', ') || '—'],
  ];
  infoRows.forEach((pair, i) => {
    const r = info.getRow(i + 3);
    r.getCell(1).value = pair[0];
    r.getCell(1).font = { bold: true, color: { argb: COLORS.brandDark }, size: 10 };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandSoft } };
    r.getCell(2).value = pair[1];
    r.getCell(2).font = { size: 10, color: { argb: COLORS.text } };
    r.eachCell((c) => {
      c.border = thinBorder();
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    r.height = 22;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const safe = String(title).replace(/[^\w\-]+/g, '-').slice(0, 40) || 'filtro';
  downloadBuffer(buffer, `sigp-vs-programacoes-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
