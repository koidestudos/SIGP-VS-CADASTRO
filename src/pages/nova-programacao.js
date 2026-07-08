import { saveProgramacao, syncLogisticaFromProgramacao, getProgramacaoById } from '../services/programacoes-service.js';
import {
  COORDENACOES, REGIONAIS, TIPOS_ATIVIDADE, formatDate,
  getCoordenacaoById, getMunicipioById, getRegionalById, getMunicipiosByRegional,
} from '../data/seed.js';
import { toast } from '../components/ui.js';

const STEPS = ['Dados Gerais', 'Local e Logística', 'Equipe', 'Recursos', 'Revisão'];
let wizardState = {};
let currentStep = 0;
let editId = null;

export function renderNovaProgramacao(user, params = []) {
  editId = params[0] === 'edit' && params[1] ? params[1] : null;
  currentStep = 0;
  if (editId) wizardState = { ...getProgramacaoById(editId) };
  else if (params[0] === 'duplicate' && params[1]) {
    const o = getProgramacaoById(params[1]);
    wizardState = { ...o, id: undefined, titulo: o.titulo + ' (Cópia)', status: 'Rascunho', dataInicial: '', dataFinal: '' };
  } else {
    wizardState = {
      titulo: '', tipoAtividade: '', coordenacaoId: '', responsavel: user.nome || '',
      objetivo: '', publicoAlvo: '', semana: '1ª Semana', dataInicial: '', dataFinal: '',
      duracao: '', regionalId: '', municipioId: '', localAtividade: '',
      necessitaTransporte: false, necessitaAlimentacao: false, obsLogistica: '',
      equipe: [], codigoOrcamentario: '', fonteRecurso: '', observacoes: '', status: 'Rascunho',
    };
  }

  return `
    <div class="cadastro-wizard-page">
      <div class="card wizard-card">
        <div class="card-body">
          ${renderSteps()}
          <div class="wizard-content" id="wizard-content">${renderStep(0)}</div>
          <div class="wizard-actions wizard-actions-v2">
            <button class="btn btn-ghost" id="wizard-cancel">Cancelar</button>
            <div class="wizard-actions-right">
              ${currentStep > 0 ? '<button class="btn btn-ghost" id="wizard-prev">← Anterior</button>' : ''}
              <button class="btn btn-outline" id="wizard-save">Salvar rascunho</button>
              <button class="btn btn-primary" id="wizard-next">${currentStep === 4 ? 'Enviar para Aprovação' : 'Próximo →'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderSteps() {
  return `<div class="wizard-steps wizard-steps-v2">${STEPS.map((l, i) => `
    <div class="wizard-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}" data-step="${i}">
      <div class="wizard-step-number">${i < currentStep ? '✓' : i + 1}</div>
      <div class="wizard-step-label">${l}</div>
    </div>`).join('')}</div>`;
}

function esc(s) { return s ? String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;') : ''; }

function municipioOptions(regionalId) {
  return getMunicipiosByRegional(regionalId).map((m) =>
    `<option value="${m.id}" ${wizardState.municipioId === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('');
}

function renderStep(step) {
  if (step === 0) return `
    <div class="wizard-form-section">
      <div class="form-group"><label>Título da ação *</label><input class="form-control" id="f-titulo" value="${esc(wizardState.titulo)}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Coordenação responsável *</label>
          <select class="form-control" id="f-coord"><option value="">Selecione...</option>
          ${COORDENACOES.map((c) => `<option value="${c.id}" ${wizardState.coordenacaoId === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}</select></div>
        <div class="form-group"><label>Responsável pela ação *</label>
          <input class="form-control" id="f-responsavel" value="${esc(wizardState.responsavel)}" placeholder="Nome do responsável" /></div>
      </div>
      <div class="form-group"><label>Objetivo</label><textarea class="form-control form-control-lg" id="f-objetivo" rows="4">${esc(wizardState.objetivo)}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Público-alvo</label><input class="form-control" id="f-publico" value="${esc(wizardState.publicoAlvo)}" /></div>
        <div class="form-group"><label>Tipo de ação/atividade *</label>
          <select class="form-control" id="f-tipo"><option value="">Selecione...</option>
          ${TIPOS_ATIVIDADE.map((t) => `<option ${wizardState.tipoAtividade === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
    </div>`;

  if (step === 1) return `
    <div class="wizard-form-section">
      <h4 class="form-section-title">Cronograma</h4>
      <div class="form-row">
        <div class="form-group"><label>Semana</label><select class="form-control" id="f-semana">${['1ª','2ª','3ª','4ª','5ª'].map((n,i)=>`<option ${wizardState.semana===`${n} Semana`?'selected':''}>${n} Semana</option>`).join('')}</select></div>
        <div class="form-group"><label>Duração</label><input class="form-control" id="f-duracao" value="${esc(wizardState.duracao)}" /></div>
        <div class="form-group"><label>Data de Ida *</label><input type="date" class="form-control" id="f-data-ini" value="${wizardState.dataInicial||''}" /></div>
        <div class="form-group"><label>Data de Volta *</label><input type="date" class="form-control" id="f-data-fim" value="${wizardState.dataFinal||''}" /></div>
      </div>
      <h4 class="form-section-title mt-3">Local</h4>
      <div class="form-row">
        <div class="form-group"><label>Regional de Saúde <span class="text-muted">(opcional)</span></label>
          <select class="form-control" id="f-regional"><option value="">Todas / Não informada</option>
          ${REGIONAIS.map((r) => `<option value="${r.id}" ${wizardState.regionalId === r.id ? 'selected' : ''}>${r.nome}</option>`).join('')}</select></div>
        <div class="form-group"><label>Município *</label>
          <select class="form-control" id="f-municipio"><option value="">Selecione...</option>${municipioOptions(wizardState.regionalId)}</select></div>
      </div>
      <div class="form-group"><label>Local da atividade</label><input class="form-control" id="f-local" value="${esc(wizardState.localAtividade)}" /></div>
      <h4 class="form-section-title mt-3">Logística</h4>
      <div class="form-row">
        <div class="form-group"><label>Transporte?</label>
          <label class="form-check"><input type="radio" name="transporte" value="sim" ${wizardState.necessitaTransporte?'checked':''}/> Sim</label>
          <label class="form-check"><input type="radio" name="transporte" value="nao" ${!wizardState.necessitaTransporte?'checked':''}/> Não</label></div>
        <div class="form-group"><label>Alimentação?</label>
          <label class="form-check"><input type="radio" name="alimentacao" value="sim" ${wizardState.necessitaAlimentacao?'checked':''}/> Sim</label>
          <label class="form-check"><input type="radio" name="alimentacao" value="nao" ${!wizardState.necessitaAlimentacao?'checked':''}/> Não</label></div>
      </div>
      <div class="form-group"><label>Observações logísticas</label><textarea class="form-control" id="f-obs-log" rows="2">${esc(wizardState.obsLogistica)}</textarea></div>
    </div>`;

  if (step === 2) {
    const eq = wizardState.equipe || [];
    return `<div class="wizard-form-section">
      <table class="table-clean mb-2"><thead><tr><th>Nome</th><th>Cargo</th><th></th></tr></thead><tbody>
      ${eq.map((e,i)=>`<tr><td>${e.nome}</td><td>${e.cargo}</td><td><button type="button" class="btn-icon danger" data-rm="${i}">🗑</button></td></tr>`).join('') || '<tr><td colspan="3" class="text-muted text-center">Nenhum participante</td></tr>'}
      </tbody></table>
      <div class="form-row"><div class="form-group"><label>Nome</label><input class="form-control" id="eq-nome"/></div>
      <div class="form-group"><label>Cargo</label><input class="form-control" id="eq-cargo"/></div></div>
      <button type="button" class="btn btn-outline btn-sm" id="btn-add-equipe">➕ Adicionar participante</button>
    </div>`;
  }

  if (step === 3) return `
    <div class="wizard-form-section">
      <div class="form-row">
        <div class="form-group"><label>Código orçamentário</label><input class="form-control" id="f-cod-orc" value="${esc(wizardState.codigoOrcamentario)}" /></div>
        <div class="form-group"><label>Fonte do recurso</label>
          <select class="form-control" id="f-fonte"><option value="">Selecione...</option>
          ${['Fundo Estadual de Saúde','Fundo Nacional de Saúde','Recursos próprios'].map(f=>`<option ${wizardState.fonteRecurso===f?'selected':''}>${f}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Observações</label><textarea class="form-control" id="f-obs" rows="4">${esc(wizardState.observacoes)}</textarea></div>
    </div>`;

  const coord = getCoordenacaoById(wizardState.coordenacaoId);
  const mun = getMunicipioById(wizardState.municipioId);
  const reg = getRegionalById(wizardState.regionalId);
  return `<div class="review-panel">
    <div class="detail-grid">
      <div class="detail-item"><label>Título</label><span>${esc(wizardState.titulo)||'—'}</span></div>
      <div class="detail-item"><label>Gerência</label><span>${coord?.gerencia||'—'}</span></div>
      <div class="detail-item"><label>Coordenação</label><span>${coord?.nome||'—'}</span></div>
      <div class="detail-item"><label>Data Ida</label><span>${formatDate(wizardState.dataInicial)}</span></div>
      <div class="detail-item"><label>Data Volta</label><span>${formatDate(wizardState.dataFinal)}</span></div>
      <div class="detail-item"><label>Município</label><span>${mun?.nome||'—'}</span></div>
      <div class="detail-item"><label>Regional</label><span>${reg?.nome||'Não informada'}</span></div>
    </div>
  </div>`;
}

function collect(step) {
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

function validate(step) {
  collect(step);
  if (step === 0 && (!wizardState.titulo || !wizardState.coordenacaoId || !wizardState.responsavel || !wizardState.tipoAtividade)) {
    toast('Preencha os campos obrigatórios.', 'error'); return false;
  }
  if (step === 1 && (!wizardState.dataInicial || !wizardState.dataFinal || !wizardState.municipioId)) {
    toast('Informe datas e município.', 'error'); return false;
  }
  return true;
}

function goTo(step) {
  currentStep = step;
  document.querySelector('.wizard-steps').outerHTML = renderSteps();
  document.getElementById('wizard-content').innerHTML = renderStep(step);
  document.getElementById('wizard-next').textContent = step === 4 ? 'Enviar para Aprovação' : 'Próximo →';
  bindStep();
  bindMain();
}

function bindStep() {
  document.getElementById('f-regional')?.addEventListener('change', (e) => {
    wizardState.regionalId = e.target.value;
    const sel = document.getElementById('f-municipio');
    if (sel) sel.innerHTML = `<option value="">Selecione...</option>${municipioOptions(wizardState.regionalId)}`;
  });
  document.getElementById('btn-add-equipe')?.addEventListener('click', () => {
    const n = document.getElementById('eq-nome')?.value.trim();
    const c = document.getElementById('eq-cargo')?.value.trim();
    if (!n || !c) return toast('Informe nome e cargo.', 'error');
    wizardState.equipe = wizardState.equipe || [];
    wizardState.equipe.push({ nome: n, cargo: c });
    document.getElementById('wizard-content').innerHTML = renderStep(2);
    bindStep(); bindMain();
  });
  document.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    wizardState.equipe.splice(Number(b.dataset.rm), 1);
    document.getElementById('wizard-content').innerHTML = renderStep(2);
    bindStep(); bindMain();
  }));
  document.querySelectorAll('.wizard-step').forEach((el) => el.addEventListener('click', () => {
    if (Number(el.dataset.step) <= currentStep) goTo(Number(el.dataset.step));
  }));
}

async function persist(status) {
  collect(currentStep);
  const saved = await saveProgramacao({ ...wizardState, status, criadoPor: wizardState.criadoPor }, editId);
  syncLogisticaFromProgramacao(saved);
  return saved;
}

function bindMain() {
  document.getElementById('wizard-prev')?.addEventListener('click', () => { collect(currentStep); goTo(currentStep - 1); });
  document.getElementById('wizard-next')?.addEventListener('click', async () => {
    if (!validate(currentStep)) return;
    if (currentStep < 4) goTo(currentStep + 1);
    else { await persist('Pendente'); toast('Enviada para aprovação!', 'success'); window.location.hash = 'programacoes'; }
  });
  document.getElementById('wizard-save')?.addEventListener('click', async () => {
    await persist('Rascunho'); toast('Rascunho salvo!', 'success');
  });
  document.getElementById('wizard-cancel')?.addEventListener('click', () => { window.location.hash = 'programacoes'; });
}

export function bindNovaProgramacao() { bindStep(); bindMain(); }
