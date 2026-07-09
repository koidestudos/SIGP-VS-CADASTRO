import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatDate, getCoordenacaoById, getMunicipioById, getRegionalById,
  getGerenciaByProgramacao,
} from '../data/seed.js';
import { normalizeStatus } from './status.js';

const BRAND = [19, 81, 180];

export function downloadProgramacaoPdf(prog) {
  if (!prog) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const coord = getCoordenacaoById(prog.coordenacaoId);
  const mun = getMunicipioById(prog.municipioId);
  const reg = getRegionalById(prog.regionalId || mun?.regionalId);
  const now = new Date();
  const equipe = (prog.equipe || []).map((e) => `${e.nome}${e.cargo ? ` (${e.cargo})` : ''}`).join(', ');

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGP-VS — Ficha da Programação', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${now.toLocaleString('pt-BR')}`, 14, 20);

  let y = 38;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(prog.titulo || 'Programação', pageW - 28);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 7 + 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const fields = [
    ['Status', normalizeStatus(prog.status)],
    ['Gerência', getGerenciaByProgramacao(prog)],
    ['Coordenação', coord?.nome || '—'],
    ['Município', mun?.nome || '—'],
    ['Regional', reg?.nome || '—'],
    ['Data de Ida', formatDate(prog.dataInicial)],
    ['Data de Volta', formatDate(prog.dataFinal)],
    ['Semana', prog.semana || '—'],
    ['Duração', prog.duracao || '—'],
    ['Tipo de ação', prog.tipoAtividade || '—'],
    ['Equipe / Responsável', equipe || prog.responsavel || '—'],
    ['Público-alvo', prog.publicoAlvo || '—'],
    ['Local', prog.localAtividade || '—'],
    ['Transporte', prog.necessitaTransporte ? 'Sim' : 'Não'],
    ['Alimentação', prog.necessitaAlimentacao ? 'Sim' : 'Não'],
    ['Código orçamentário', prog.codigoOrcamentario || '—'],
    ['Fonte do recurso', prog.fonteRecurso || '—'],
  ];

  fields.forEach(([label, value]) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(String(value), pageW - 70);
    doc.text(lines, 62, y);
    y += Math.max(lines.length * 5, 7) + 2;
  });

  if (prog.objetivo) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text('Objetivo:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const objLines = doc.splitTextToSize(prog.objetivo, pageW - 28);
    doc.text(objLines, 14, y);
    y += objLines.length * 5 + 4;
  }

  if (prog.observacoes) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text('Observações:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(prog.observacoes, pageW - 28), 14, y);
  }

  const slug = (prog.titulo || 'programacao').slice(0, 30).replace(/[^\w\-]+/g, '-');
  doc.save(`sigp-vs-${slug}-${now.toISOString().slice(0, 10)}.pdf`);
}

export function downloadProgramacoesListPdf(items, { title = 'Relatório de Programações', subtitle = '' } = {}) {
  if (!items.length) throw new Error('Nenhuma programação no filtro atual.');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGP-VS — Programações', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 17);
  if (subtitle) doc.text(subtitle, 14, 22);
  doc.text(`${items.length} registro(s) · ${now.toLocaleString('pt-BR')}`, pageW - 14, 17, { align: 'right' });

  const rows = items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipioById(p.municipioId);
    const eq = (p.equipe || []).map((e) => e.nome).filter(Boolean).join(', ') || p.responsavel || '—';
    return [
      (p.titulo || '—').slice(0, 50),
      getGerenciaByProgramacao(p),
      (coord?.nome || '—').slice(0, 35),
      (mun?.nome || '—').slice(0, 22),
      formatDate(p.dataInicial),
      formatDate(p.dataFinal),
      normalizeStatus(p.status),
      eq.slice(0, 35),
    ];
  });

  autoTable(doc, {
    startY: subtitle ? 28 : 26,
    head: [['Ação', 'Ger.', 'Coordenação', 'Município', 'Ida', 'Volta', 'Status', 'Equipe']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
  });

  const safe = title.replace(/[^\w\-]+/g, '-').slice(0, 40);
  doc.save(`sigp-vs-programacoes-${safe}-${now.toISOString().slice(0, 10)}.pdf`);
}
