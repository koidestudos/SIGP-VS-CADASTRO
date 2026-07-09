import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProgramacoes } from '../services/programacoes-service.js';
import {
  formatDate, getCoordenacaoById, getMunicipioById, getGerenciaByProgramacao,
} from '../data/seed.js';
import {
  countServidores, countByGerencia, countByRegional, countByStatus, countByMonth,
} from './bi-metrics.js';

const BRAND = { primary: [19, 81, 180], green: [22, 136, 33], gray: [100, 116, 139] };

function drawBarChart(doc, x, y, w, h, items, title) {
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, y);
  const max = Math.max(...items.map((i) => i.value), 1);
  const barH = Math.min(14, (h - 20) / Math.max(items.length, 1));
  let cy = y + 10;
  items.slice(0, 8).forEach((item) => {
    const bw = ((item.value / max) * (w - 90)) || 2;
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.gray);
    doc.setFont('helvetica', 'normal');
    doc.text(String(item.label).slice(0, 18), x, cy + barH * 0.65);
    doc.setFillColor(...(item.color ? hexToRgb(item.color) : BRAND.primary));
    doc.rect(x + 72, cy, bw, barH - 2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.text(String(item.value), x + 74 + bw + 4, cy + barH * 0.65);
    cy += barH + 2;
  });
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function kpiBox(doc, x, y, w, h, label, value) {
  doc.setFillColor(240, 247, 255);
  doc.roundedRect(x, y, w, h, 3, 3, 'F');
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 6, y + 12);
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value), x + 6, y + 26);
}

export async function downloadBiReportPdf() {
  const programacoes = getProgramacoes();
  const now = new Date();
  const ano = now.getFullYear();
  const porGerencia = countByGerencia(programacoes).filter((g) => g.value > 0);
  const porRegional = countByRegional(programacoes).slice(0, 8).map((r) => ({
    label: r.nome.replace('Regional ', ''),
    value: r.programacoes,
    color: '#1351B4',
  }));
  const porStatus = countByStatus(programacoes);
  const porMes = countByMonth(programacoes, ano);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGP-VS — Relatório BI Gerencial', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema Integrado de Gestão de Programações da Vigilância em Saúde', 14, 21);
  doc.text(`DUVAS / SESAPI · Gerado em ${now.toLocaleString('pt-BR')}`, 14, 27);

  // KPIs
  const kpiY = 40;
  const kpiW = (pageW - 28 - 12) / 4;
  kpiBox(doc, 14, kpiY, kpiW, 30, 'Total de Programações', programacoes.length);
  kpiBox(doc, 14 + kpiW + 4, kpiY, kpiW, 30, 'Municípios', new Set(programacoes.map((p) => p.municipioId)).size);
  kpiBox(doc, 14 + (kpiW + 4) * 2, kpiY, kpiW, 30, 'Coordenações', new Set(programacoes.map((p) => p.coordenacaoId)).size);
  kpiBox(doc, 14 + (kpiW + 4) * 3, kpiY, kpiW, 30, 'Servidores', countServidores(programacoes));

  // Gráficos
  const chartY = 78;
  const halfW = (pageW - 32) / 2;
  drawBarChart(doc, 14, chartY, halfW, 70, porGerencia, 'Programações por Gerência');
  drawBarChart(doc, 14 + halfW + 4, chartY, halfW, 70, porRegional, 'Programações por Regional');

  // Status + Mensal
  const chart2Y = 152;
  drawBarChart(doc, 14, chart2Y, halfW, 55, porStatus.map((s) => ({
    label: s.label, value: s.value, color: s.color,
  })), 'Distribuição por Status');
  drawBarChart(doc, 14 + halfW + 4, chart2Y, halfW, 55, porMes.filter((m) => m.value > 0).map((m) => ({
    label: m.label, value: m.value, color: '#1351B4',
  })), `Programações por Mês (${ano})`);

  // Tabela
  doc.addPage();
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento das Programações', 14, 18);

  const rows = programacoes.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipioById(p.municipioId);
    const eq = (p.equipe || []).map((e) => e.nome).filter(Boolean).join(', ') || p.responsavel || '—';
    return [
      (p.titulo || '—').slice(0, 45),
      getGerenciaByProgramacao(p),
      (coord?.nome || '—').slice(0, 28),
      (mun?.nome || '—').slice(0, 20),
      formatDate(p.dataInicial),
      formatDate(p.dataFinal),
      p.status || '—',
      eq.slice(0, 30),
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [['Ação', 'Ger.', 'Coordenação', 'Município', 'Ida', 'Volta', 'Status', 'Equipe']],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.gray);
      doc.text(`Página ${data.pageNumber} de ${pg}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    },
  });

  doc.save(`sigp-vs-bi-${now.toISOString().slice(0, 10)}.pdf`);
}
