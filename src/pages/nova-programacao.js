import {
  getCollection, addItem, updateItem, getItemById, canEdit, syncLogistica,
} from '../services/storage.js';
import {
  COORDENACOES, MUNICIPIOS, REGIONAIS, TIPOS_ATIVIDADE, generateId, formatDate,
  getCoordenacaoById, getMunicipioById, getRegionalById,
} from '../data/seed.js';
import { toast } from '../components/ui.js';

const STEPS = [
  'Dados Gerais', 'Cronograma', 'Local', 'Logística', 'Equipe', 'Complementares', 'Revisão',
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

  return `
    <div class="page-header">
      <h2>${editId ? 'Editar Programação' : duplicateId ? 'Duplicar Programação' : 'Nova Programação'}</h2>
      ${duplicateId ? '<span class="badge badge-aprovada">Dados copiados — altere datas e local</span>' : ''}
    </div>
    <div class="card">
      <div class="card-body">
        ${renderWizardSteps()}
        <div class="wizard-content" id="wizard-content">${renderStepContent(0)}</div>
        <div class="wizard-actions">
          <button class="btn btn-ghost" id="wizard-prev" ${currentStep === 0 ? 'disabled' : ''}>← Anterior</button>
          <div>
            <button class="btn btn-outline" id="wizard-save">Salvar Rascunho</button>
            <button class="btn btn-primary" id="wizard-next">${currentStep === 6 ? 'Enviar para Aprovação' : 'Próximo →'}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createEmptyState(user) {
  const coord = user.coordenacaoId || '';
  return {
    titulo: '', tipoAtividade: '', coordenacaoId: coord, responsavel: user.nome || '',
    objetivo: '', publicoAlvo: '', semana: '1ª Semana', dataInicial: '', dataFinal: '',
    duracao: '', regionalId: '', municipioId: '', localAtividade: '',
    necessitaTransporte: false, necessitaAlimentacao: false, obsLogistica: '',
    equipe: [], codigoOrcamentario: '', fonteRecurso: '', observacoes: '', documentos: [],
    status: 'Rascunho',
  };
}

function renderWizardSteps() {
  return `
    <div class="wizard-steps">
      ${STEPS.map((label, i) => `
        <div class="wizard-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}" data-step="${i}">
          <div class="wizard-step-number">${i < currentStep ? '✓' : i + 1}</div>
          <div class="wizard-step-label">${label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStepContent(step) {
  switch (step) {
    case 0: return renderStep1();
    case 1: return renderStep2();
    case 2: return renderStep3();
    case 3: return renderStep4();
    case 4: return renderStep5();
    case 5: return renderStep6();
    case 6: return renderStep7();
    default: return '';
  }
}

function renderStep1() {
  return `
    <h3 class="section-title">Etapa 1 — Dados Gerais</h3>
    <div class="form-group">
      <label>Título da ação *</label>
      <input type="text" class="form-control" id="f-titulo" value="${esc(wizardState.titulo)}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipo da atividade *</label>
        <select class="form-control" id="f-tipo">
          <option value="">Selecione...</option>
          ${TIPOS_ATIVIDADE.map((t) => `<option ${wizardState.tipoAtividade === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Coordenação *</label>
        <select class="form-control" id="f-coord">
          <option value="">Selecione...</option>
          ${COORDENACOES.map((c) => `<option value="${c.id}" ${wizardState.coordenacaoId === c.id ? 'selected' : ''}>${c.gerencia} — ${c.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Responsável *</label>
      <input type="text" class="form-control" id="f-responsavel" value="${esc(wizardState.responsavel)}" />
    </div>
    <div class="form-group">
      <label>Objetivo</label>
      <textarea class="form-control" id="f-objetivo">${esc(wizardState.objetivo)}</textarea>
    </div>
    <div class="form-group">
      <label>Público-alvo</label>
      <input type="text" class="form-control" id="f-publico" value="${esc(wizardState.publicoAlvo)}" />
    </div>
  `;
}

function renderStep2() {
  return `
    <h3 class="section-title">Etapa 2 — Cronograma</h3>
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
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data inicial *</label>
        <input type="date" class="form-control" id="f-data-ini" value="${wizardState.dataInicial || ''}" />
      </div>
      <div class="form-group">
        <label>Data final *</label>
        <input type="date" class="form-control" id="f-data-fim" value="${wizardState.dataFinal || ''}" />
      </div>
    </div>
  `;
}

function renderStep3() {
  return `
    <h3 class="section-title">Etapa 3 — Local</h3>
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
    <div class="form-group">
      <label>Local da atividade</label>
      <input type="text" class="form-control" id="f-local" value="${esc(wizardState.localAtividade)}" />
    </div>
  `;
}

function renderStep4() {
  return `
    <h3 class="section-title">Etapa 4 — Logística</h3>
    <div class="form-group">
      <label>Necessita transporte?</label>
      <label class="form-check"><input type="radio" name="transporte" value="sim" ${wizardState.necessitaTransporte ? 'checked' : ''} /> Sim</label>
      <label class="form-check"><input type="radio" name="transporte" value="nao" ${!wizardState.necessitaTransporte ? 'checked' : ''} /> Não</label>
    </div>
    <div class="form-group">
      <label>Necessita alimentação?</label>
      <label class="form-check"><input type="radio" name="alimentacao" value="sim" ${wizardState.necessitaAlimentacao ? 'checked' : ''} /> Sim</label>
      <label class="form-check"><input type="radio" name="alimentacao" value="nao" ${!wizardState.necessitaAlimentacao ? 'checked' : ''} /> Não</label>
    </div>
    <div class="form-group">
      <label>Observações logísticas</label>
      <textarea class="form-control" id="f-obs-log">${esc(wizardState.obsLogistica)}</textarea>
    </div>
  `;
}

function renderStep5() {
  const equipe = wizardState.equipe || [];
  return `
    <h3 class="section-title">Etapa 5 — Equipe</h3>
    <div class="table-wrapper mb-2">
      <table id="tabela-equipe-wizard">
        <thead><tr><th>Nome</th><th>Cargo</th><th></th></tr></thead>
        <tbody>
          ${equipe.map((e, i) => `
            <tr data-idx="${i}">
              <td>${e.nome}</td><td>${e.cargo}</td>
              <td><button class="btn-icon danger" data-remove-equipe="${i}">🗑</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" class="form-control" id="eq-nome" />
      </div>
      <div class="form-group">
        <label>Cargo</label>
        <input type="text" class="form-control" id="eq-cargo" />
      </div>
    </div>
    <button class="btn btn-outline btn-sm" id="btn-add-equipe">➕ Adicionar participante</button>
  `;
}

function renderStep6() {
  return `
    <h3 class="section-title">Etapa 6 — Informações Complementares</h3>
    <div class="form-row">
      <div class="form-group">
        <label>Código da ação orçamentária</label>
        <input type="text" class="form-control" id="f-cod-orc" value="${esc(wizardState.codigoOrcamentario)}" />
      </div>
      <div class="form-group">
        <label>Fonte do recurso</label>
        <input type="text" class="form-control" id="f-fonte" value="${esc(wizardState.fonteRecurso)}" />
      </div>
    </div>
    <div class="form-group">
      <label>Observações</label>
      <textarea class="form-control" id="f-obs">${esc(wizardState.observacoes)}</textarea>
    </div>
    <div class="form-group">
      <label>Anexar documentos</label>
      <input type="file" class="form-control" id="f-docs" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" />
      <p class="text-sm text-muted mt-1">Ofícios, cronogramas, listas de presença, relatórios, fotos, atas</p>
      ${(wizardState.documentos || []).length ? `
        <ul class="file-list mt-2">
          ${wizardState.documentos.map((d) => `<li>📄 ${d.nome}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

function renderStep7() {
  const coord = getCoordenacaoById(wizardState.coordenacaoId);
  const mun = getMunicipioById(wizardState.municipioId);
  const reg = getRegionalById(wizardState.regionalId);

  return `
    <h3 class="section-title">Etapa 7 — Revisão</h3>
    <div class="review-section">
      <h4>Dados Gerais</h4>
      <div class="detail-grid">
        <div class="detail-item"><label>Título</label><span>${esc(wizardState.titulo) || '—'}</span></div>
        <div class="detail-item"><label>Tipo</label><span>${wizardState.tipoAtividade || '—'}</span></div>
        <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
        <div class="detail-item"><label>Responsável</label><span>${wizardState.responsavel || '—'}</span></div>
      </div>
    </div>
    <div class="review-section">
      <h4>Cronograma e Local</h4>
      <div class="detail-grid">
        <div class="detail-item"><label>Período</label><span>${formatDate(wizardState.dataInicial)} — ${formatDate(wizardState.dataFinal)}</span></div>
        <div class="detail-item"><label>Regional</label><span>${reg?.nome || '—'}</span></div>
        <div class="detail-item"><label>Município</label><span>${mun?.nome || '—'}</span></div>
        <div class="detail-item"><label>Local</label><span>${wizardState.localAtividade || '—'}</span></div>
      </div>
    </div>
    <div class="review-section">
      <h4>Logística</h4>
      <div class="detail-grid">
        <div class="detail-item"><label>Transporte</label><span>${wizardState.necessitaTransporte ? 'Sim' : 'Não'}</span></div>
        <div class="detail-item"><label>Alimentação</label><span>${wizardState.necessitaAlimentacao ? 'Sim' : 'Não'}</span></div>
      </div>
    </div>
    ${wizardState.equipe?.length ? `
      <div class="review-section">
        <h4>Equipe (${wizardState.equipe.length} participantes)</h4>
        <p class="text-sm">${wizardState.equipe.map((e) => `${e.nome} — ${e.cargo}`).join('; ')}</p>
      </div>
    ` : ''}
    <div class="approval-flow mt-3">
      <span class="step">Gerência cadastra</span><span class="arrow">↓</span>
      <span class="step">Revisa informações</span><span class="arrow">↓</span>
      <span class="step">Aprova programação</span><span class="arrow">↓</span>
      <span class="step">Publicada no calendário</span>
    </div>
  `;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function collectStepData(step) {
  switch (step) {
    case 0:
      wizardState.titulo = document.getElementById('f-titulo')?.value || '';
      wizardState.tipoAtividade = document.getElementById('f-tipo')?.value || '';
      wizardState.coordenacaoId = document.getElementById('f-coord')?.value || '';
      wizardState.responsavel = document.getElementById('f-responsavel')?.value || '';
      wizardState.objetivo = document.getElementById('f-objetivo')?.value || '';
      wizardState.publicoAlvo = document.getElementById('f-publico')?.value || '';
      break;
    case 1:
      wizardState.semana = document.getElementById('f-semana')?.value || '';
      wizardState.duracao = document.getElementById('f-duracao')?.value || '';
      wizardState.dataInicial = document.getElementById('f-data-ini')?.value || '';
      wizardState.dataFinal = document.getElementById('f-data-fim')?.value || '';
      break;
    case 2:
      wizardState.regionalId = document.getElementById('f-regional')?.value || '';
      wizardState.municipioId = document.getElementById('f-municipio')?.value || '';
      wizardState.localAtividade = document.getElementById('f-local')?.value || '';
      break;
    case 3:
      wizardState.necessitaTransporte = document.querySelector('input[name="transporte"]:checked')?.value === 'sim';
      wizardState.necessitaAlimentacao = document.querySelector('input[name="alimentacao"]:checked')?.value === 'sim';
      wizardState.obsLogistica = document.getElementById('f-obs-log')?.value || '';
      break;
    case 5:
      wizardState.codigoOrcamentario = document.getElementById('f-cod-orc')?.value || '';
      wizardState.fonteRecurso = document.getElementById('f-fonte')?.value || '';
      wizardState.observacoes = document.getElementById('f-obs')?.value || '';
      break;
  }
}

function validateStep(step) {
  collectStepData(step);
  if (step === 0 && (!wizardState.titulo || !wizardState.tipoAtividade || !wizardState.coordenacaoId)) {
    toast('Preencha os campos obrigatórios da Etapa 1.', 'error');
    return false;
  }
  if (step === 1 && (!wizardState.dataInicial || !wizardState.dataFinal)) {
    toast('Informe as datas do cronograma.', 'error');
    return false;
  }
  if (step === 2 && (!wizardState.regionalId || !wizardState.municipioId)) {
    toast('Selecione regional e município.', 'error');
    return false;
  }
  return true;
}

function goToStep(step) {
  if (step < 0 || step > 6) return;
  currentStep = step;
  document.querySelector('.wizard-steps').outerHTML = renderWizardSteps();
  document.getElementById('wizard-content').innerHTML = renderStepContent(step);
  document.getElementById('wizard-prev').disabled = step === 0;
  document.getElementById('wizard-next').textContent = step === 6 ? 'Enviar para Aprovação' : 'Próximo →';
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
    document.getElementById('wizard-content').innerHTML = renderStepContent(4);
    bindStepEvents();
    bindWizardNav();
  });

  document.querySelectorAll('[data-remove-equipe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wizardState.equipe.splice(Number(btn.dataset.removeEquipe), 1);
      document.getElementById('wizard-content').innerHTML = renderStepContent(4);
      bindStepEvents();
      bindWizardNav();
    });
  });

  document.getElementById('f-docs')?.addEventListener('change', (e) => {
    if (!wizardState.documentos) wizardState.documentos = [];
    Array.from(e.target.files).forEach((f) => {
      wizardState.documentos.push({ nome: f.name, tipo: f.type, tamanho: f.size });
    });
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

export function bindNovaProgramacao(user) {
  bindStepEvents();
  bindWizardNav();

  document.getElementById('wizard-prev')?.addEventListener('click', () => {
    collectStepData(currentStep);
    goToStep(currentStep - 1);
  });

  document.getElementById('wizard-next')?.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 6) {
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
    toast('Rascunho salvo com sucesso!', 'success');
  });
}
