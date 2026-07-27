import { jsPDF } from 'jspdf';

const BRAND = [19, 81, 180];
const TEXT = [30, 41, 59];
const MUTED = [100, 116, 139];

function checkbox(mark) {
  return mark ? '[X]' : '[ ]';
}

function formatDateBr(isoDate) {
  if (!isoDate) return '____/____/________';
  const [y, m, d] = String(isoDate).split('-');
  if (!y || !m || !d) return String(isoDate);
  return `${d}/${m}/${y}`;
}

function underlineValue(value, fallback = '_________________________________') {
  const v = String(value || '').trim();
  return v || fallback;
}

/**
 * Coleta valores do formulário do relatório simplificado.
 * @param {ParentNode} root
 */
export function collectModeloAnexoForm(root) {
  const q = (sel) => root.querySelector(sel);
  const situacao = q('input[name="modelo-situacao"]:checked')?.value || '';
  const anexos = [...root.querySelectorAll('input[name="modelo-anexos"]:checked')].map((el) => el.value);
  return {
    nomeAcao: q('#modelo-nome-acao')?.value?.trim() || '',
    municipio: q('#modelo-municipio')?.value?.trim() || '',
    local: q('#modelo-local')?.value?.trim() || '',
    dataRealizacao: q('#modelo-data-realizacao')?.value || '',
    situacao,
    resumo: q('#modelo-resumo')?.value?.trim() || '',
    numParticipantes: q('#modelo-num-participantes')?.value?.trim() || '',
    municipiosParticipantes: q('#modelo-municipios-participantes')?.value?.trim() || '',
    observacoes: q('#modelo-observacoes')?.value?.trim() || '',
    anexos,
    responsavelNome: q('#modelo-responsavel-nome')?.value?.trim() || '',
    responsavelCargo: q('#modelo-responsavel-cargo')?.value?.trim() || '',
    dataEnvio: q('#modelo-data-envio')?.value || '',
  };
}

/**
 * Valida campos obrigatórios do relatório.
 * @returns {string|null} mensagem de erro ou null se ok
 */
export function validateModeloAnexoForm(data) {
  if (!data.nomeAcao) return 'Informe o nome da ação.';
  if (!data.municipio) return 'Informe o município.';
  if (!data.local) return 'Informe o local.';
  if (!data.dataRealizacao) return 'Informe a data da realização.';
  if (!data.situacao) return 'Selecione a situação da ação.';
  if (!data.resumo) return 'Preencha o resumo da execução.';
  if (!data.numParticipantes) return 'Informe o número de participantes.';
  if (!data.responsavelNome) return 'Informe o nome do responsável.';
  if (!data.responsavelCargo) return 'Informe o cargo do responsável.';
  if (!data.dataEnvio) return 'Informe a data de envio.';
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderModeloAnexoFormHtml(defaults = {}) {
  const d = defaults;
  const situacao = d.situacao || '';
  const anexos = new Set(d.anexos || []);
  const checked = (v) => (situacao === v ? 'checked' : '');
  const anexoChecked = (v) => (anexos.has(v) ? 'checked' : '');
  const today = new Date().toISOString().slice(0, 10);
  const v = (key, fallback = '') => escapeHtml(d[key] ?? fallback);

  return `
    <form id="form-modelo-anexo" class="modelo-anexo-form">
      <p class="text-sm text-muted mb-3">Preencha o Relatório Simplificado de Execução da Ação. Ao final, exporte o PDF preenchido.</p>

      <fieldset class="modelo-section">
        <legend>1. Informações da Programação</legend>
        <div class="form-group">
          <label for="modelo-nome-acao">Nome da ação *</label>
          <input type="text" class="form-control" id="modelo-nome-acao" value="${v('nomeAcao')}" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="modelo-municipio">Município *</label>
            <input type="text" class="form-control" id="modelo-municipio" value="${v('municipio')}" required />
          </div>
          <div class="form-group">
            <label for="modelo-local">Local *</label>
            <input type="text" class="form-control" id="modelo-local" value="${v('local')}" required />
          </div>
        </div>
        <div class="form-group">
          <label for="modelo-data-realizacao">Data da realização *</label>
          <input type="date" class="form-control" id="modelo-data-realizacao" value="${v('dataRealizacao')}" required />
        </div>
      </fieldset>

      <fieldset class="modelo-section">
        <legend>2. Situação da Ação *</legend>
        <div class="modelo-radio-row">
          <label><input type="radio" name="modelo-situacao" value="Realizada" ${checked('Realizada')} /> Realizada</label>
          <label><input type="radio" name="modelo-situacao" value="Realizada com alterações" ${checked('Realizada com alterações')} /> Realizada com alterações</label>
          <label><input type="radio" name="modelo-situacao" value="Não realizada" ${checked('Não realizada')} /> Não realizada</label>
        </div>
      </fieldset>

      <fieldset class="modelo-section">
        <legend>3. Resumo da Execução *</legend>
        <div class="form-group">
          <textarea class="form-control" id="modelo-resumo" rows="4" required placeholder="Descreva brevemente a execução da ação">${v('resumo')}</textarea>
        </div>
      </fieldset>

      <fieldset class="modelo-section">
        <legend>4. Público Atendido</legend>
        <div class="form-row">
          <div class="form-group">
            <label for="modelo-num-participantes">Número de participantes *</label>
            <input type="text" class="form-control" id="modelo-num-participantes" value="${v('numParticipantes')}" required />
          </div>
          <div class="form-group">
            <label for="modelo-municipios-participantes">Municípios participantes (quando houver)</label>
            <input type="text" class="form-control" id="modelo-municipios-participantes" value="${v('municipiosParticipantes')}" />
          </div>
        </div>
      </fieldset>

      <fieldset class="modelo-section">
        <legend>5. Pendências ou Observações</legend>
        <div class="form-group">
          <textarea class="form-control" id="modelo-observacoes" rows="3" placeholder="Pendências, observações ou restrições">${v('observacoes')}</textarea>
        </div>
      </fieldset>

      <fieldset class="modelo-section">
        <legend>6. Anexos</legend>
        <div class="modelo-check-row">
          <label><input type="checkbox" name="modelo-anexos" value="Lista de presença" ${anexoChecked('Lista de presença')} /> Lista de presença</label>
          <label><input type="checkbox" name="modelo-anexos" value="Fotos" ${anexoChecked('Fotos')} /> Fotos</label>
          <label><input type="checkbox" name="modelo-anexos" value="Ata/Relatório" ${anexoChecked('Ata/Relatório')} /> Ata/Relatório</label>
          <label><input type="checkbox" name="modelo-anexos" value="Outros" ${anexoChecked('Outros')} /> Outros</label>
        </div>
      </fieldset>

      <fieldset class="modelo-section">
        <legend>7. Responsável pelo Relatório</legend>
        <div class="form-row">
          <div class="form-group">
            <label for="modelo-responsavel-nome">Nome *</label>
            <input type="text" class="form-control" id="modelo-responsavel-nome" value="${v('responsavelNome')}" required />
          </div>
          <div class="form-group">
            <label for="modelo-responsavel-cargo">Cargo *</label>
            <input type="text" class="form-control" id="modelo-responsavel-cargo" value="${v('responsavelCargo')}" required />
          </div>
        </div>
        <div class="form-group">
          <label for="modelo-data-envio">Data de envio *</label>
          <input type="date" class="form-control" id="modelo-data-envio" value="${v('dataEnvio', today)}" required />
        </div>
      </fieldset>
    </form>
  `;
}

/**
 * Gera e baixa PDF no formato do Relatório Simplificado de Execução da Ação.
 */
export function downloadModeloAnexoPdf(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 18;

  const ensureSpace = (need = 12) => {
    if (y + need > 285) {
      doc.addPage();
      y = 18;
    }
  };

  const writeWrapped = (text, x, size = 11, style = 'normal', color = TEXT) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ''), contentW - (x - margin));
    doc.text(lines, x, y);
    y += lines.length * (size * 0.42) + 2;
    return lines.length;
  };

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BRAND);
  doc.text('RELATÓRIO SIMPLIFICADO DE EXECUÇÃO DA', pageW / 2, y, { align: 'center' });
  y += 7;
  doc.text('AÇÃO', pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // 1
  writeWrapped('1. Informações da Programação', margin, 12, 'bold', BRAND);
  writeWrapped(`Nome da ação: ${underlineValue(data.nomeAcao)}`, margin, 11);
  writeWrapped(`Município: ${underlineValue(data.municipio)}`, margin, 11);
  writeWrapped(`Local: ${underlineValue(data.local)}`, margin, 11);
  writeWrapped(`Data da realização: ${formatDateBr(data.dataRealizacao)}`, margin, 11);
  y += 3;

  // 2
  ensureSpace(20);
  writeWrapped('2. Situação da Ação', margin, 12, 'bold', BRAND);
  const sit = data.situacao || '';
  writeWrapped(
    `${checkbox(sit === 'Realizada')} Realizada     ${checkbox(sit === 'Realizada com alterações')} Realizada com alterações     ${checkbox(sit === 'Não realizada')} Não realizada`,
    margin,
    11,
  );
  y += 3;

  // 3
  ensureSpace(28);
  writeWrapped('3. Resumo da Execução', margin, 12, 'bold', BRAND);
  const resumo = String(data.resumo || '').trim() || '_____________________________________________________________________';
  writeWrapped(resumo, margin, 11);
  y += 3;

  // 4
  ensureSpace(22);
  writeWrapped('4. Público Atendido', margin, 12, 'bold', BRAND);
  writeWrapped(`Número de participantes: ${underlineValue(data.numParticipantes, '____________')}`, margin, 11);
  writeWrapped(
    `Municípios participantes (quando houver): ${underlineValue(data.municipiosParticipantes, '____________________________')}`,
    margin,
    11,
  );
  y += 3;

  // 5
  ensureSpace(28);
  writeWrapped('5. Pendências ou Observações', margin, 12, 'bold', BRAND);
  const obs = String(data.observacoes || '').trim() || '_____________________________________________________________________';
  writeWrapped(obs, margin, 11);
  y += 3;

  // 6
  ensureSpace(20);
  writeWrapped('6. Anexos', margin, 12, 'bold', BRAND);
  const a = new Set(data.anexos || []);
  writeWrapped(
    `${checkbox(a.has('Lista de presença'))} Lista de presença    ${checkbox(a.has('Fotos'))} Fotos    ${checkbox(a.has('Ata/Relatório'))} Ata/Relatório    ${checkbox(a.has('Outros'))} Outros`,
    margin,
    11,
  );
  y += 3;

  // 7
  ensureSpace(28);
  writeWrapped('7. Responsável pelo Relatório', margin, 12, 'bold', BRAND);
  writeWrapped(`Nome: ${underlineValue(data.responsavelNome, '___________________________')}`, margin, 11);
  writeWrapped(`Cargo: ${underlineValue(data.responsavelCargo, '___________________________')}`, margin, 11);
  writeWrapped(`Data de envio: ${formatDateBr(data.dataEnvio)}`, margin, 11);

  y += 8;
  ensureSpace(10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Documento gerado pelo SIGP-VS', margin, y);

  const safeName = (data.nomeAcao || 'acao').replace(/[^\wÀ-ÿ\- ]+/g, '').trim().slice(0, 40) || 'acao';
  doc.save(`Relatorio_Simplificado_Execucao_${safeName}.pdf`);
}
