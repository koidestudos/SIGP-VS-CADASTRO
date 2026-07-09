import { jsPDF } from 'jspdf';
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
