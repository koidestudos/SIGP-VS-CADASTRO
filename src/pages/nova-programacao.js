import {
  getCollection, addItem, updateItem, getItemById, canEdit, syncLogistica, isAdmin,
} from '../services/storage.js';
import {
  COORDENACOES, MUNICIPIOS, REGIONAIS, TIPOS_ATIVIDADE, generateId, formatDate,
  getCoordenacaoById, getMunicipioById, getRegionalById, EQUIPES,
} from '../data/seed.js';
import { toast } from '../components/ui.js';

const STEPS_CADASTRO = [
  'Dados Gerais',
  'Local e Logística',
  'Equipe',
  'Recursos',
  'Anexos',
  'Revisão',
];

let wizardState = {};
let currentStep = 0;
let editId = null;
let duplicateId = null;

export function renderNovaProgramacao(user, params = []) {
  if (!canEdit(user)) {
    return `<div class="alert alert-warning">Você não tem permissão para cadastrar programações.</div>`;
  }

  editId = null;
  duplicateId = null;
  currentStep = 0;

  if (params[0] === 'edit' && params[1]) {
    editId = params[1];
    wizardState = { ...getItemById('programacoes', editId) };
  } else if (params[0] === 'duplicate' && params[1]) {
    duplicateId = params[1];
    const orig = getItemById('programacoes', params[1]);
    wizardState = {
      ...orig,
      id: undefined,
      titulo: orig.titulo + ' (Cópia)',
      status: 'Rascunho',
      dataInicial: '',
      dataFinal: '',
    };
  } else {
    wizardState = createEmptyState(user);
  }

  const titulo = editId ? 'Editar Programação' : duplicateId ? 'Duplicar Programação' : 'Nova Programação';

  return `
    <div class="cadastro-wizard-page">
      ${isAdmin(user) ? `<div class="page-header"><h2>${titulo}</h2></div>` : ''}
      <div class="card wizard-card">
        <div class="card-body">
          ${renderWizardSteps()}
          <div class="wizard-content" id="wizard-content">${renderStepContent(0)}</div>
          <div class="wizard-actions wizard-actions-v2">
            <button class="btn btn-ghost" id="wizard-cancel">Cancelar</button>
            <div class="wizard-actions-right">
              ${currentStep > 0 ? `<button class="btn btn-ghost" id="wizard-prev">← Anterior</button>` : ''}
              <button class="btn btn-outline" id="wizard-save">Salvar rascunho</button>
              <button class="btn btn-primary" id="wizard-next">${currentStep === 5 ? 'Enviar para Aprovação' : 'Próximo →'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createEmptyState(user) {
  return {
    titulo: '', tipoAtividade: '', coordenacaoId: user.coordenacaoId || '', responsavel: user.nome || '',
    objetivo: '', publicoAlvo: '', semana: '1ª Semana', dataInicial: '', dataFinal: '',
    duracao: '', regionalId: '', municipioId: '', localAtividade: '',
    necessitaTransporte: false, necessitaAlimentacao: false, obsLogistica: '',
    equipe: [], codigoOrcamentario: '', fonteRecurso: '', observacoes: '', documentos: [],
    status: 'Rascunho',
  };
}

function renderWizardSteps() {
  return `
    <div class="wizard-steps wizard-steps-v2">
      ${STEPS_CADASTRO.map((label, i) => `
        <div class="wizard-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}" data-step="${i}">
          <div class="wizard-step-line ${i < STEPS_CADASTRO.length - 1 ? '' : 'last'}"></div>
          <div class="wizard-step-number">${i < currentStep ? '✓' : i + 1}</div>
          <div class="wizard-step-label">${label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStepContent(step) {
  const steps = [renderStepDados, renderStepLocalLogistica, renderStepEquipe, renderStepRecursos, renderStepAnexos, renderStepRevisao];
  return steps[step]?.() || '';
}

function renderStepDados() {
  const responsaveis = getCollection('equipes').concat(EQUIPES.filter((e) => !getCollection('equipes').find((x) => x.nome === e.nome)));
  const respUnicos = [...new Map(responsaveis.map((e) => [e.nome, e])).values()];

  return `
    <div class="wizard-form-section">
      <div class="form-group">
        <label>Título da ação *</label>
        <input type="text" class="form-control" id="f-titulo" placeholder="Descreva a ação a ser realizada" value="${esc(wizardState.titulo)}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Coordenação responsável *</label>
          <select class="form-control" id="f-coord">
            <option value="">Selecione...</option>
            ${COORDENACOES.map((c) => `<option value="${c.id}" ${wizardState.coordenacaoId === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Responsável pela ação *</label>
          <select class="form-control" id="f-responsavel">
            <option value="">Selecione...</option>
            ${respUnicos.map((e) => `<option ${wizardState.responsavel === e.nome ? 'selected' : ''}>${e.nome}</option>`).join('')}
            ${wizardState.responsavel && !respUnicos.find((e) => e.nome === wizardState.responsavel)
              ? `<option selected>${wizardState.responsavel}</option>` : ''}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Objetivo</label>
        <textarea class="form-control form-control-lg" id="f-objetivo" placeholder="Descreva o objetivo da ação" rows="4">${esc(wizardState.objetivo)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Público-alvo</label>
          <input type="text" class="form-control" id="f-publico" placeholder="Ex: Profissionais de saúde da APS" value="${esc(wizardState.publicoAlvo)}" />
        </div>
        <div class="form-group">
          <label>Tipo de ação/atividade *</label>
          <select class="form-control" id="f-tipo">
            <option value="">Selecione...</option>
            ${TIPOS_ATIVIDADE.map((t) => `<option ${wizardState.tipoAtividade === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderStepLocalLogistica() {
  return `
    <div class="wizard-form-section">
      <h4 class="form-section-title">Cronograma</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Semana</label>
          <select class="form-control" id="f-semana">
            ${['1ª Semana', '2ª Semana', '3ª Semana', '4ª Semana', '5ª Semana'].map((s) =>
              `<option ${wizardState.semana === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Duração</label>
          <input type="text" class="form-control" id="f-duracao" value="${esc(wizardState.duracao)}" placeholder="Ex: 3 dias" />
        </div>
        <div class="form-group">
          <label>Data inicial *</label>
          <input type="date" class="form-control" id="f-data-ini" value="${wizardState.dataInicial || ''}" />
        </div>
        <div class="form-group">
          <label>Data final *</label>
          <input type="date" class="form-control" id="f-data-fim" value="${wizardState.dataFinal || ''}" />
        </div>
      </div>

      <h4 class="form-section-title mt-3">Local</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Regional de Saúde *</label>
          <select class="form-control" id="f-regional">
            <option value="">Selecione...</option>
            ${REGIONAIS.map((r) => `<option value="${r.id}" ${wizardState.regionalId === r.id ? 'selected' : ''}>${r.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Município *</label>
          <select class="form-control" id="f-municipio">
            <option value="">Selecione...</option>
            ${MUNICIPIOS.map((m) => `<option value="${m.id}" ${wizardState.municipioId === m.id ? 'selected' : ''}>${m.nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Local da atividade</label>
        <input type="text" class="form-control" id="f-local" placeholder="Ex: Secretaria Municipal de Saúde" value="${esc(wizardState.localAtividade)}" />
      </div>

      <h4 class="form-section-title mt-3">Logística</h4>
      <div class="form-row">
        <div class="form-group">
          <label>Necessita transporte?</label>
          <div class="radio-group">
            <label class="form-check"><input type="radio" name="transporte" value="sim" ${wizardState.necessitaTransporte ? 'checked' : ''} /> Sim</label>
            <label class="form-check"><input type="radio" name="transporte" value="nao" ${!wizardState.necessitaTransporte ? 'checked' : ''} /> Não</label>
          </div>
        </div>
        <div class="form-group">
          <label>Necessita alimentação?</label>
          <div class="radio-group">
            <label class="form-check"><input type="radio" name="alimentacao" value="sim" ${wizardState.necessitaAlimentacao ? 'checked' : ''} /> Sim</label>
            <label class="form-check"><input type="radio" name="alimentacao" value="nao" ${!wizardState.necessitaAlimentacao ? 'checked' : ''} /> Não</label>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Observações logísticas</label>
        <textarea class="form-control" id="f-obs-log" rows="2">${esc(wizardState.obsLogistica)}</textarea>
      </div>
    </div>
  `;
}

function renderStepEquipe() {
  const equipe = wizardState.equipe || [];
  return `
    <div class="wizard-form-section">
      <div class="table-wrapper mb-2">
        <table id="tabela-equipe-wizard" class="table-clean">
          <thead><tr><th>Nome</th><th>Cargo</th><th width="48"></th></tr></thead>
          <tbody>
            ${equipe.length ? equipe.map((e, i) => `
              <tr><td>${e.nome}</td><td>${e.cargo}</td>
              <td><button type="button" class="btn-icon danger" data-remove-equipe="${i}">🗑</button></td></tr>
            `).join('') : '<tr><td colspan="3" class="text-muted text-center">Nenhum participante adicionado</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" class="form-control" id="eq-nome" placeholder="Nome do participante" />
        </div>
        <div class="form-group">
          <label>Cargo</label>
          <input type="text" class="form-control" id="eq-cargo" placeholder="Ex: Enfermeira" />
        </div>
      </div>
      <button type="button" class="btn btn-outline btn-sm" id="btn-add-equipe">➕ Adicionar participante</button>
    </div>
  `;
}

function renderStepRecursos() {
  return `
    <div class="wizard-form-section">
      <div class="form-row">
        <div class="form-group">
          <label>Código da ação orçamentária</label>
          <input type="text" class="form-control" id="f-cod-orc" placeholder="Ex: 2026.001.0045" value="${esc(wizardState.codigoOrcamentario)}" />
        </div>
        <div class="form-group">
          <label>Fonte do recurso</label>
          <select class="form-control" id="f-fonte">
            <option value="">Selecione...</option>
            ${['Fundo Estadual de Saúde', 'Fundo Nacional de Saúde', 'Recursos próprios', 'Convênio', 'Emenda parlamentar'].map((f) =>
              `<option ${wizardState.fonteRecurso === f ? 'selected' : ''}>${f}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Observações</label>
        <textarea class="form-control" id="f-obs" rows="4" placeholder="Informações adicionais sobre recursos">${esc(wizardState.observacoes)}</textarea>
      </div>
    </div>
  `;
}

function renderStepAnexos() {
  return `
    <div class="wizard-form-section">
      <div class="upload-zone" id="upload-zone">
        <div class="upload-zone-icon">📁</div>
        <p><strong>Anexar documentos</strong></p>
        <p class="text-sm text-muted">Ofícios, cronogramas, listas de presença, relatórios, fotos, atas</p>
        <input type="file" class="form-control mt-2" id="f-docs" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" />
      </div>
      ${(wizardState.documentos || []).length ? `
        <ul class="file-list mt-3">
          ${wizardState.documentos.map((d) => `<li>📄 ${d.nome}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

function renderStepRevisao() {
  const coord = getCoordenacaoById(wizardState.coordenacaoId);
  const mun = getMunicipioById(wizardState.municipioId);
  const reg = getRegionalById(wizardState.regionalId);

  return `
    <div class="wizard-form-section review-panel">
      <div class="review-section">
        <h4>Dados Gerais</h4>
        <div class="detail-grid">
          <div class="detail-item"><label>Título</label><span>${esc(wizardState.titulo) || '—'}</span></div>
          <div class="detail-item"><label>Tipo</label><span>${wizardState.tipoAtividade || '—'}</span></div>
          <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
          <div class="detail-item"><label>Responsável</label><span>${wizardState.responsavel || '—'}</span></div>
          <div class="detail-item full"><label>Objetivo</label><span>${wizardState.objetivo || '—'}</span></div>
        </div>
      </div>
      <div class="review-section">
        <h4>Local e Logística</h4>
        <div class="detail-grid">
          <div class="detail-item"><label>Período</label><span>${formatDate(wizardState.dataInicial)} — ${formatDate(wizardState.dataFinal)}</span></div>
          <div class="detail-item"><label>Regional</label><span>${reg?.nome || '—'}</span></div>
          <div class="detail-item"><label>Município</label><span>${mun?.nome || '—'}</span></div>
          <div class="detail-item"><label>Transporte</label><span>${wizardState.necessitaTransporte ? 'Sim' : 'Não'}</span></div>
          <div class="detail-item"><label>Alimentação</label><span>${wizardState.necessitaAlimentacao ? 'Sim' : 'Não'}</span></div>
        </div>
      </div>
      ${wizardState.equipe?.length ? `
        <div class="review-section">
          <h4>Equipe (${wizardState.equipe.length})</h4>
          <p class="text-sm">${wizardState.equipe.map((e) => `${e.nome} — ${e.cargo}`).join(' · ')}</p>
        </div>
      ` : ''}
      <div class="approval-flow mt-3">
        <span class="step">Gerência cadastra</span><span class="arrow">→</span>
        <span class="step">Revisa</span><span class="arrow">→</span>
        <span class="step">Aprova</span><span class="arrow">→</span>
        <span class="step">Publicada no calendário</span>
      </div>
    </div>
  `;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function collectStepData(step) {
  if (step === 0) {
    wizardState.titulo = document.getElementById('f-titulo')?.value || '';
    wizardState.coordenacaoId = document.getElementById('f-coord')?.value || '';
    wizardState.responsavel = document.getElementById('f-responsavel')?.value || '';
    wizardState.objetivo = document.getElementById('f-objetivo')?.value || '';
    wizardState.publicoAlvo = document.getElementById('f-publico')?.value || '';
    wizardState.tipoAtividade = document.getElementById('f-tipo')?.value || '';
  }
  if (step === 1) {
    wizardState.semana = document.getElementById('f-semana')?.value || '';
    wizardState.duracao = document.getElementById('f-duracao')?.value || '';
    wizardState.dataInicial = document.getElementById('f-data-ini')?.value || '';
    wizardState.dataFinal = document.getElementById('f-data-fim')?.value || '';
    wizardState.regionalId = document.getElementById('f-regional')?.value || '';
    wizardState.municipioId = document.getElementById('f-municipio')?.value || '';
    wizardState.localAtividade = document.getElementById('f-local')?.value || '';
    wizardState.necessitaTransporte = document.querySelector('input[name="transporte"]:checked')?.value === 'sim';
    wizardState.necessitaAlimentacao = document.querySelector('input[name="alimentacao"]:checked')?.value === 'sim';
    wizardState.obsLogistica = document.getElementById('f-obs-log')?.value || '';
  }
  if (step === 3) {
    wizardState.codigoOrcamentario = document.getElementById('f-cod-orc')?.value || '';
    wizardState.fonteRecurso = document.getElementById('f-fonte')?.value || '';
    wizardState.observacoes = document.getElementById('f-obs')?.value || '';
  }
}

function validateStep(step) {
  collectStepData(step);
  if (step === 0) {
    if (!wizardState.titulo || !wizardState.coordenacaoId || !wizardState.tipoAtividade) {
      toast('Preencha título, coordenação e tipo de atividade.', 'error');
      return false;
    }
  }
  if (step === 1) {
    if (!wizardState.dataInicial || !wizardState.dataFinal || !wizardState.regionalId || !wizardState.municipioId) {
      toast('Preencha datas, regional e município.', 'error');
      return false;
    }
  }
  return true;
}

const MAX_STEP = 5;

function updateWizardButtons() {
  const nextBtn = document.getElementById('wizard-next');
  const prevBtn = document.getElementById('wizard-prev');
  if (nextBtn) nextBtn.textContent = currentStep === MAX_STEP ? 'Enviar para Aprovação' : 'Próximo →';
  if (prevBtn) prevBtn.style.display = currentStep === 0 ? 'none' : '';
}

function goToStep(step) {
  if (step < 0 || step > MAX_STEP) return;
  currentStep = step;
  document.querySelector('.wizard-steps').outerHTML = renderWizardSteps();
  document.getElementById('wizard-content').innerHTML = renderStepContent(step);
  updateWizardButtons();
  bindStepEvents();
  bindWizardNav();
}

function saveProgramacao(status) {
  collectStepData(currentStep);
  const user = JSON.parse(sessionStorage.getItem('sigp_vs_auth'));
  const data = {
    ...wizardState,
    status,
    criadoPor: user?.id,
    criadoEm: wizardState.criadoEm || new Date().toISOString().split('T')[0],
  };

  let saved;
  if (editId) {
    saved = updateItem('programacoes', editId, data);
  } else {
    data.id = generateId('p');
    saved = addItem('programacoes', data);
  }

  if (saved && (saved.necessitaTransporte || saved.necessitaAlimentacao)) {
    syncLogistica(saved);
  }
  return saved;
}

function bindStepEvents() {
  document.getElementById('btn-add-equipe')?.addEventListener('click', () => {
    const nome = document.getElementById('eq-nome')?.value.trim();
    const cargo = document.getElementById('eq-cargo')?.value.trim();
    if (!nome || !cargo) { toast('Informe nome e cargo.', 'error'); return; }
    if (!wizardState.equipe) wizardState.equipe = [];
    wizardState.equipe.push({ nome, cargo });
    document.getElementById('wizard-content').innerHTML = renderStepContent(2);
    bindStepEvents();
    bindWizardNav();
  });

  document.querySelectorAll('[data-remove-equipe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wizardState.equipe.splice(Number(btn.dataset.removeEquipe), 1);
      document.getElementById('wizard-content').innerHTML = renderStepContent(2);
      bindStepEvents();
      bindWizardNav();
    });
  });

  document.getElementById('f-docs')?.addEventListener('change', (e) => {
    if (!wizardState.documentos) wizardState.documentos = [];
    Array.from(e.target.files).forEach((f) => {
      wizardState.documentos.push({ nome: f.name, tipo: f.type, tamanho: f.size });
    });
    document.getElementById('wizard-content').innerHTML = renderStepContent(4);
    bindStepEvents();
  });
}

function bindWizardNav() {
  document.querySelectorAll('.wizard-step').forEach((el) => {
    el.addEventListener('click', () => {
      const target = Number(el.dataset.step);
      if (target <= currentStep) goToStep(target);
    });
  });
}

function bindMainActions() {
  document.getElementById('wizard-prev')?.addEventListener('click', () => {
    collectStepData(currentStep);
    goToStep(currentStep - 1);
  });

  document.getElementById('wizard-next')?.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < MAX_STEP) {
      goToStep(currentStep + 1);
    } else {
      saveProgramacao('Pendente');
      toast('Programação enviada para aprovação!', 'success');
      window.location.hash = 'programacoes';
    }
  });

  document.getElementById('wizard-save')?.addEventListener('click', () => {
    collectStepData(currentStep);
    saveProgramacao('Rascunho');
    toast('Rascunho salvo!', 'success');
  });

  document.getElementById('wizard-cancel')?.addEventListener('click', () => {
    window.location.hash = 'programacoes';
  });
}

export function bindNovaProgramacao(user) {
  bindStepEvents();
  bindWizardNav();
  bindMainActions();
}
