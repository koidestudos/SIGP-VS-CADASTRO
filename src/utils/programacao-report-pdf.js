import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatDate, getCoordenacaoById, getMunicipioById, getRegionalById,
  getGerenciaByProgramacao, getMunicipiosLabel, getMunicipioIdsFromProgramacao,
} from '../data/seed.js';
import { normalizeStatus } from './status.js';
import { getAnexosByProgramacao, getAnexoBlob } from '../services/anexos-service.js';

const BRAND = [19, 81, 180];
let pdfDownloadLock = null;

/** Remove anexos duplicados (mesmo id ou mesmo arquivo). */
function uniqueAnexos(anexos) {
  const byId = new Map();
  const byFile = new Set();
  (anexos || []).forEach((a) => {
    if (!a?.id || byId.has(a.id)) return;
    const key = `${String(a.nomeArquivo || '').toLowerCase()}|${a.tamanho || 0}|${a.enviadoPor || ''}`;
    if (byFile.has(key)) return;
    byFile.add(key);
    byId.set(a.id, a);
  });
  return [...byId.values()];
}

function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function isPdfAnexo(anexo, mime) {
  const m = String(mime || anexo.mimeType || '').toLowerCase();
  const name = String(anexo.nomeArquivo || '').toLowerCase();
  return m.includes('pdf') || name.endsWith('.pdf');
}

function isImageAnexo(anexo, mime) {
  const m = String(mime || anexo.mimeType || '').toLowerCase();
  const name = String(anexo.nomeArquivo || '').toLowerCase();
  return m.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name);
}

async function blobToJpegBytes(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!jpegBlob) throw new Error('Falha ao converter imagem.');
  return new Uint8Array(await jpegBlob.arrayBuffer());
}

function truncatePdfText(text, max) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function appendNotePage(pdfDoc, PDFLib, title, lines) {
  const { rgb, StandardFonts } = PDFLib;
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({
    x: 0, y: page.getHeight() - 28, width: page.getWidth(), height: 28,
    color: rgb(19 / 255, 81 / 255, 180 / 255),
  });
  page.drawText(truncatePdfText(title, 90), {
    x: 14, y: page.getHeight() - 18, size: 11, font: bold, color: rgb(1, 1, 1),
  });
  let y = page.getHeight() - 56;
  for (const line of lines) {
    const wrapped = wrapText(String(line), 90);
    for (const w of wrapped) {
      page.drawText(w, { x: 14, y, size: 10, font, color: rgb(0.15, 0.18, 0.22) });
      y -= 14;
      if (y < 40) return;
    }
    y -= 4;
  }
}

function wrapText(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach((word) => {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > width) {
      if (cur) lines.push(cur);
      cur = word;
    } else cur = next;
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function buildFichaDoc(prog) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const coord = getCoordenacaoById(prog.coordenacaoId);
  const reg = getRegionalById(prog.regionalId || getMunicipioById(getMunicipioIdsFromProgramacao(prog)[0])?.regionalId);
  const now = new Date();
  const equipe = (prog.equipe || []).map((e) => `${e.nome}${e.cargo ? ` (${e.cargo})` : ''}`).join(', ');
  const anexos = uniqueAnexos(getAnexosByProgramacao(prog.id));

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
    ['Município(s)', getMunicipiosLabel(prog)],
    ['Regional', reg?.nome || '—'],
    ['Data inicial', formatDate(prog.dataInicial)],
    ['Data final', formatDate(prog.dataFinal)],
    ['Semana', prog.semana || '—'],
    ['Duração', prog.duracao || '—'],
    ['Tipo de ação', prog.tipoAtividade || '—'],
    ['Equipe / Responsável', equipe || prog.responsavel || '—'],
    ['Público-alvo', prog.publicoAlvo || '—'],
    ['Local', prog.localAtividade || '—'],
    ['Transporte', prog.transporteTipo === 'microonibus' ? 'Sim (microônibus)' : (prog.necessitaTransporte ? 'Sim' : 'Não')],
    ['Alimentação', prog.necessitaAlimentacao ? 'Sim' : 'Não'],
    ['Código orçamentário', prog.codigoOrcamentario || '—'],
    ['Fonte do recurso', prog.fonteRecurso || '—'],
    ['Anexos', anexos.length ? `${anexos.length} arquivo(s) incluído(s) a seguir` : 'Nenhum'],
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

  if (anexos.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text('Lista de anexos:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    anexos.forEach((a, i) => {
      if (y > 275) { doc.addPage(); y = 20; }
      const line = `${i + 1}. ${a.nomeArquivo || 'arquivo'} — ${a.enviadoPorNome || '—'}`;
      doc.text(doc.splitTextToSize(line, pageW - 28), 14, y);
      y += 6;
    });
  }

  return { doc, now, anexos };
}

/**
 * Gera PDF da ficha e embute anexos (PDF/imagem) quando existirem.
 */
export async function downloadProgramacaoPdf(prog) {
  if (!prog) return;
  // Impede download duplo (clique rápido / listeners re-bindados)
  if (pdfDownloadLock) return pdfDownloadLock;

  pdfDownloadLock = (async () => {
    const { doc, now, anexos } = buildFichaDoc(prog);
    const slug = (prog.titulo || 'programacao').slice(0, 30).replace(/[^\w\-]+/g, '-');
    const filename = `sigp-vs-${slug}-${now.toISOString().slice(0, 10)}.pdf`;

    if (!anexos.length) {
      doc.save(filename);
      return;
    }

    const PDFLib = await import('pdf-lib');
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const merged = await PDFDocument.create();
    const ficha = await PDFDocument.load(doc.output('arraybuffer'));
    (await merged.copyPages(ficha, ficha.getPageIndices())).forEach((p) => merged.addPage(p));

    const embeddedKeys = new Set();
    for (const anexo of anexos) {
      const embedKey = `${anexo.id}|${String(anexo.nomeArquivo || '').toLowerCase()}|${anexo.tamanho || 0}`;
      if (embeddedKeys.has(embedKey)) continue;
      embeddedKeys.add(embedKey);
      try {
        const blob = await getAnexoBlob(anexo);
        const mime = blob.type || anexo.mimeType || '';
        if (isPdfAnexo(anexo, mime)) {
          const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
          (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p));
          continue;
        }
        if (isImageAnexo(anexo, mime)) {
          const jpegBytes = await blobToJpegBytes(blob);
          const image = await merged.embedJpg(jpegBytes);
          const page = merged.addPage([595.28, 841.89]);
          page.drawRectangle({
            x: 0, y: page.getHeight() - 28, width: page.getWidth(), height: 28,
            color: rgb(19 / 255, 81 / 255, 180 / 255),
          });
          const font = await merged.embedFont(StandardFonts.HelveticaBold);
          page.drawText(truncatePdfText(`Anexo: ${anexo.nomeArquivo || 'imagem'}`, 80), {
            x: 14, y: page.getHeight() - 18, size: 10, font, color: rgb(1, 1, 1),
          });
          const margin = 36;
          const headerH = 36;
          const maxW = page.getWidth() - margin * 2;
          const maxH = page.getHeight() - margin - headerH;
          const scale = Math.min(maxW / image.width, maxH / image.height, 1);
          const w = image.width * scale;
          const h = image.height * scale;
          page.drawImage(image, {
            x: (page.getWidth() - w) / 2,
            y: margin + Math.max(0, (maxH - h) / 2),
            width: w,
            height: h,
          });
          continue;
        }
        await appendNotePage(merged, PDFLib, `Anexo: ${anexo.nomeArquivo || 'arquivo'}`, [
          'Este tipo de arquivo não pode ser embutido no PDF.',
          `Arquivo: ${anexo.nomeArquivo || '—'}`,
          `Tipo: ${mime || anexo.mimeType || '—'}`,
          `Enviado por: ${anexo.enviadoPorNome || '—'}`,
          'Abra o anexo pelo sistema SIGP-VS para visualizar o conteúdo original.',
        ]);
      } catch (err) {
        console.error('Falha ao embutir anexo no PDF:', err);
        try {
          await appendNotePage(merged, PDFLib, `Anexo: ${anexo.nomeArquivo || 'arquivo'}`, [
            'Não foi possível embutir este anexo no PDF.',
            err?.message || 'Erro desconhecido.',
          ]);
        } catch (_) { /* ignore */ }
      }
    }

    downloadBlob(await merged.save(), filename);
  })().finally(() => {
    pdfDownloadLock = null;
  });

  return pdfDownloadLock;
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
    const mun = getMunicipiosLabel(p);
    const eq = (p.equipe || []).map((e) => e.nome).filter(Boolean).join(', ') || p.responsavel || '—';
    return [
      (p.titulo || '—').slice(0, 50),
      getGerenciaByProgramacao(p),
      (coord?.nome || '—').slice(0, 35),
      (mun || '—').slice(0, 22),
      formatDate(p.dataInicial),
      formatDate(p.dataFinal),
      normalizeStatus(p.status),
      eq.slice(0, 35),
    ];
  });

  autoTable(doc, {
    startY: subtitle ? 28 : 26,
    head: [['Ação', 'Ger.', 'Coordenação', 'Município', 'Inicial', 'Final', 'Status', 'Equipe']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
  });

  const safe = title.replace(/[^\w\-]+/g, '-').slice(0, 40);
  doc.save(`sigp-vs-programacoes-${safe}-${now.toISOString().slice(0, 10)}.pdf`);
}
