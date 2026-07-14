import { saveProgramacao, syncLogisticaFromProgramacao, getProgramacaoById } from '../services/programacoes-service.js';
import { canEditProgramacao } from '../services/roles.js';
import {
  COORDENACOES, REGIONAIS, TIPOS_ATIVIDADE, formatDate,
  getCoordenacaoById, getMunicipioById, getMunicipiosByRegionais,
  getMunicipiosLabel, getRegionaisLabel, MUNICIPIO_OUTROS_ID,
} from '../data/seed.js';
import { toast } from '../components/ui.js';

const STEPS = ['Dados Gerais', 'Local e Logística', 'Equipe', 'Recursos', 'Revisão'];
let wizardState = {};
let currentStep = 0;
let editId = null;
/** Evita zerar o formulário quando outro usuário dispara re-render */
let wizardSessionKey = null;

export function resetWizardSession() {
  wizardSessionKey = null;
  currentStep = 0;
  editId = null;
  wizardState = {};
}

function sessionKeyFromParams(params = []) {
  if (params[0] === 'edit' && params[1]) return `edit:${params[1]}`;
  if (params[0] === 'duplicate' && params[1]) return `dup:${params[1]}`;
  return 'new';
}

function normalizeWizardState(state) {
  const next = { ...state };
  if (!Array.isArray(next.municipioIds)) {
    next.municipioIds = next.municipioId ? [next.municipioId] : [];
  }
  next.municipioIds = next.municipioIds.filter(Boolean);
  next.municipioId = next.municipioIds[0] || next.municipioId || '';

  if (!Array.isArray(next.regionalIds)) {
    next.regionalIds = next.regionalId ? [next.regionalId] : [];
  }
  next.regionalIds = next.regionalIds.filter(Boolean);
  next.regionalId = next.regionalIds[0] || next.regionalId || '';
  return next;
}

function calcSemanaFromDate(dateStr) {
  if (!dateStr) return '';
  const day = Number(dateStr.split('-')[2]);
  const weekNum = Math.min(5, Math.ceil(day / 7));
  return `${['1ª', '2ª', '3ª', '4ª', '5ª'][weekNum - 1]} Semana`;
}

function calcDuracao(dataIni, dataFim) {
  if (!dataIni || !dataFim) return '';
  const start = new Date(`${dataIni}T12:00:00`);
  const end = new Date(`${dataFim}T12:00:00`);
  if (end < start) return '';
  const days = Math.round((end - start) / 86400000) + 1;
  return days === 1 ? '1 dia' : `${days} dias`;
}

function updateCronogramaFromDates() {
  const ini = document.getElementById('f-data-ini')?.value || '';
  const fim = document.getElementById('f-data-fim')?.value || '';
  wizardState.dataInicial = ini;
  wizardState.dataFinal = fim;
  if (ini) wizardState.semana = calcSemanaFromDate(ini);
  if (ini && fim) wizardState.duracao = calcDuracao(ini, fim);
  const semEl = document.getElementById('f-semana');
  const durEl = document.getElementById('f-duracao');
  if (semEl) semEl.value = wizardState.semana || '';
  if (durEl) durEl.value = wizardState.duracao || '';
}

export function renderNovaProgramacao(user, params = []) {
  const nextKey = sessionKeyFromParams(params);
  const resume = wizardSessionKey === nextKey && wizardState && typeof wizardState === 'object';

  if (!resume) {
    wizardSessionKey = nextKey;
    editId = params[0] === 'edit' && params[1] ? params[1] : null;
    currentStep = 0;
    if (editId) {
      const existing = getProgramacaoById(editId);
      if (!existing || !canEditProgramacao(user, existing)) {
        wizardSessionKey = null;
        return `<div class="card"><div class="card-body"><p class="alert alert-error">Você não pode editar esta programação.</p>
          <button class="btn btn-primary" onclick="window.location.hash='programacoes'">Voltar</button></div></div>`;
      }
      wizardState = normalizeWizardState({
        ...existing,
        baseAtualizadoEm: existing.atualizadoEm || '',
      });
    } else if (params[0] === 'duplicate' && params[1]) {
      const o = getProgramacaoById(params[1]);
      wizardState = normalizeWizardState({
        ...o,
        id: undefined,
        titulo: `${o.titulo} (Cópia)`,
        status: 'Rascunho',
        dataInicial: '',
        dataFinal: '',
        semana: '',
        duracao: '',
        baseAtualizadoEm: '',
      });
    } else {
      wizardState = normalizeWizardState({
        titulo: '', tipoAtividade: '', coordenacaoId: '', responsavel: '',
        objetivo: '', publicoAlvo: '', semana: '', dataInicial: '', dataFinal: '',
        duracao: '', regionalId: '', regionalIds: [], municipioId: '', municipioIds: [], localAtividade: '',
        necessitaTransporte: false, necessitaAlimentacao: false, obsLogistica: '',
        equipe: [], codigoOrcamentario: '', fonteRecurso: '', observacoes: '', status: 'Rascunho',
        baseAtualizadoEm: '',
      });
    }
  } else {
    editId = params[0] === 'edit' && params[1] ? params[1] : null;
  }

  return `
    <div class="cadastro-wizard-page">
      <div class="card wizard-card">
        <div class="card-body">
          ${renderSteps()}
          <div class="wizard-content" id="wizard-content">${renderStep(currentStep)}</div>
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

function municipioAddOptions(regionalIds) {
  const selected = new Set(wizardState.municipioIds || []);
  const list = getMunicipiosByRegionais(regionalIds || wizardState.regionalIds || []);
  const options = list
    .filter((m) => !selected.has(m.id))
    .map((m) => `<option value="${m.id}">${m.nome}</option>`)
    .join('');
  return `${options}<option value="${MUNICIPIO_OUTROS_ID}">Outros (fora do Piauí)</option>`;
}

function renderRegionaisList() {
  const ids = wizardState.regionalIds || [];
  if (!ids.length) {
    return '<p class="text-sm text-muted mb-2">Nenhuma regional adicionada.</p>';
  }
  return `<ul class="mun-chip-list mb-2">${ids.map((id) => {
    const reg = REGIONAIS.find((r) => r.id === id);
    return `<li class="mun-chip">
      <span>${reg?.nome || id}</span>
      <button type="button" class="mun-chip-remove" data-rm-reg="${id}" title="Remover">×</button>
    </li>`;
  }).join('')}</ul>`;
}

function renderMunicipiosList() {
  const ids = wizardState.municipioIds || [];
  if (!ids.length) {
    return '<p class="text-sm text-muted mb-2">Nenhum município adicionado.</p>';
  }
  return `<ul class="mun-chip-list mb-2">${ids.map((id) => {
    const mun = getMunicipioById(id);
    return `<li class="mun-chip">
      <span>${mun?.nome || id}</span>
      <button type="button" class="mun-chip-remove" data-rm-mun="${esc(id)}" title="Remover">×</button>
    </li>`;
  }).join('')}</ul>`;
}

function regionalAddOptions() {
  const selected = new Set(wizardState.regionalIds || []);
  return REGIONAIS
    .filter((r) => !selected.has(r.id))
    .map((r) => `<option value="${r.id}">${r.nome}</option>`)
    .join('');
}

function renderStep(step) {
  if (step === 0) return `
    <div class="wizard-form-section">
      <div class="form-group"><label>Título da ação *</label><input class="form-control" id="f-titulo" value="${esc(wizardState.titulo)}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Coordenação responsável *</label>
          <select class="form-control" id="f-coord"><option value="">Selecione...</option>
          ${COORDENACOES.map((c) => `<option value="${c.id}" ${wizardState.coordenacaoId === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}</select></div>
        <div class="form-group"><label>Tipo de ação/atividade *</label>
          <select class="form-control" id="f-tipo"><option value="">Selecione...</option>
          ${TIPOS_ATIVIDADE.map((t) => `<option ${wizardState.tipoAtividade === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Objetivo</label><textarea class="form-control form-control-lg" id="f-objetivo" rows="4">${esc(wizardState.objetivo)}</textarea></div>
      <div class="form-group"><label>Público-alvo</label><input class="form-control" id="f-publico" value="${esc(wizardState.publicoAlvo)}" /></div>
    </div>`;

  if (step === 1) return `
    <div class="wizard-form-section">
      <h4 class="form-section-title">Cronograma</h4>
      <div class="form-row">
        <div class="form-group"><label>Data de Ida *</label><input type="date" class="form-control" id="f-data-ini" value="${wizardState.dataInicial || ''}" /></div>
        <div class="form-group"><label>Data de Volta *</label><input type="date" class="form-control" id="f-data-fim" value="${wizardState.dataFinal || ''}" /></div>
        <div class="form-group"><label>Semana</label><input class="form-control" id="f-semana" value="${esc(wizardState.semana)}" readonly placeholder="Calculada automaticamente" /></div>
        <div class="form-group"><label>Duração</label><input class="form-control" id="f-duracao" value="${esc(wizardState.duracao)}" readonly placeholder="Calculada automaticamente" /></div>
      </div>
      <p class="text-sm text-muted mb-3">A semana e a duração são calculadas automaticamente a partir das datas de ida e volta.</p>
      <h4 class="form-section-title mt-3">Local</h4>
      <div class="form-group"><label>Regionais de Saúde <span class="text-muted">(opcional, pode adicionar várias)</span></label>
        ${renderRegionaisList()}
        <div class="form-row mun-add-row">
          <div class="form-group flex-2">
            <select class="form-control" id="f-regional-add"><option value="">Selecione uma regional...</option>${regionalAddOptions()}</select>
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-regional">➕ Adicionar regional</button>
          </div>
        </div>
      </div>
      <div class="form-group"><label>Municípios *</label>
        ${renderMunicipiosList()}
        <div class="form-row mun-add-row">
          <div class="form-group flex-2">
            <select class="form-control" id="f-municipio-add"><option value="">Selecione um município...</option>${municipioAddOptions(wizardState.regionalIds)}</select>
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-municipio">➕ Adicionar município</button>
          </div>
        </div>
        <div class="form-group mt-2 hidden" id="outros-nome-wrap">
          <label>Nome do município fora do Piauí</label>
          <input class="form-control" id="f-municipio-outros-nome" placeholder="Ex.: São Luís - MA" />
          <p class="text-sm text-muted mt-1">Opcional. Se deixar em branco, será registrado apenas como “Outros”.</p>
        </div>
      </div>
      <div class="form-group"><label>Local da atividade</label><input class="form-control" id="f-local" value="${esc(wizardState.localAtividade)}" /></div>
      <h4 class="form-section-title mt-3">Logística</h4>
      <div class="form-row">
        <div class="form-group"><label>Transporte?</label>
          <label class="form-check"><input type="radio" name="transporte" value="sim" ${wizardState.necessitaTransporte ? 'checked' : ''}/> Sim</label>
          <label class="form-check"><input type="radio" name="transporte" value="nao" ${!wizardState.necessitaTransporte ? 'checked' : ''}/> Não</label></div>
        <div class="form-group"><label>Alimentação?</label>
          <label class="form-check"><input type="radio" name="alimentacao" value="sim" ${wizardState.necessitaAlimentacao ? 'checked' : ''}/> Sim</label>
          <label class="form-check"><input type="radio" name="alimentacao" value="nao" ${!wizardState.necessitaAlimentacao ? 'checked' : ''}/> Não</label></div>
      </div>
      <div class="form-group"><label>Observações logísticas</label><textarea class="form-control" id="f-obs-log" rows="2">${esc(wizardState.obsLogistica)}</textarea></div>
    </div>`;

  if (step === 2) {
    const eq = wizardState.equipe || [];
    return `<div class="wizard-form-section">
      <p class="text-sm text-muted mb-3">Cadastre os participantes que irão compor a equipe desta ação. <strong>Pelo menos um participante é obrigatório.</strong></p>
      <table class="table-clean mb-2"><thead><tr><th>Nome</th><th>Cargo</th><th></th></tr></thead><tbody>
      ${eq.map((e, i) => `<tr><td>${e.nome}</td><td>${e.cargo}</td><td><button type="button" class="btn-icon danger" data-rm="${i}">🗑</button></td></tr>`).join('') || '<tr><td colspan="3" class="text-muted text-center">Nenhum participante</td></tr>'}
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
          <input class="form-control" id="f-fonte" value="${esc(wizardState.fonteRecurso)}" placeholder="Ex.: Fundo Estadual de Saúde, 600, online..." /></div>
      </div>
      <div class="form-group"><label>Observações</label><textarea class="form-control" id="f-obs" rows="4">${esc(wizardState.observacoes)}</textarea></div>
    </div>`;

  const coord = getCoordenacaoById(wizardState.coordenacaoId);
  const eq = (wizardState.equipe || []).map((e) => `${e.nome} (${e.cargo})`).join(', ');
  return `<div class="review-panel">
    <div class="detail-grid">
      <div class="detail-item"><label>Título</label><span>${esc(wizardState.titulo) || '—'}</span></div>
      <div class="detail-item"><label>Gerência</label><span>${coord?.gerencia || '—'}</span></div>
      <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
      <div class="detail-item"><label>Tipo</label><span>${esc(wizardState.tipoAtividade) || '—'}</span></div>
      <div class="detail-item"><label>Data Ida</label><span>${formatDate(wizardState.dataInicial)}</span></div>
      <div class="detail-item"><label>Data Volta</label><span>${formatDate(wizardState.dataFinal)}</span></div>
      <div class="detail-item"><label>Semana</label><span>${esc(wizardState.semana) || '—'}</span></div>
      <div class="detail-item"><label>Duração</label><span>${esc(wizardState.duracao) || '—'}</span></div>
      <div class="detail-item"><label>Municípios</label><span>${getMunicipiosLabel(wizardState)}</span></div>
      <div class="detail-item"><label>Regionais</label><span>${getRegionaisLabel(wizardState)}</span></div>
      <div class="detail-item full-width"><label>Equipe</label><span>${eq || '—'}</span></div>
    </div>
  </div>`;
}

function collect(step) {
  if (step === 0) {
    const titulo = document.getElementById('f-titulo');
    const coord = document.getElementById('f-coord');
    const objetivo = document.getElementById('f-objetivo');
    const publico = document.getElementById('f-publico');
    const tipo = document.getElementById('f-tipo');
    if (titulo) wizardState.titulo = titulo.value || '';
    if (coord) wizardState.coordenacaoId = coord.value || '';
    if (objetivo) wizardState.objetivo = objetivo.value || '';
    if (publico) wizardState.publicoAlvo = publico.value || '';
    if (tipo) wizardState.tipoAtividade = tipo.value || '';
  }
  if (step === 1) {
    const dataIni = document.getElementById('f-data-ini');
    const dataFim = document.getElementById('f-data-fim');
    const semana = document.getElementById('f-semana');
    const duracao = document.getElementById('f-duracao');
    const local = document.getElementById('f-local');
    const obsLog = document.getElementById('f-obs-log');
    if (dataIni) wizardState.dataInicial = dataIni.value || '';
    if (dataFim) wizardState.dataFinal = dataFim.value || '';
    if (semana) wizardState.semana = semana.value || calcSemanaFromDate(wizardState.dataInicial);
    if (duracao) wizardState.duracao = duracao.value || calcDuracao(wizardState.dataInicial, wizardState.dataFinal);
    if (local) wizardState.localAtividade = local.value || '';
    const transporte = document.querySelector('input[name="transporte"]:checked');
    const alimentacao = document.querySelector('input[name="alimentacao"]:checked');
    if (transporte) wizardState.necessitaTransporte = transporte.value === 'sim';
    if (alimentacao) wizardState.necessitaAlimentacao = alimentacao.value === 'sim';
    if (obsLog) wizardState.obsLogistica = obsLog.value || '';
    wizardState.municipioId = wizardState.municipioIds?.[0] || '';
    wizardState.regionalId = wizardState.regionalIds?.[0] || '';
  }
  if (step === 3) {
    const cod = document.getElementById('f-cod-orc');
    const fonte = document.getElementById('f-fonte');
    const obs = document.getElementById('f-obs');
    if (cod) wizardState.codigoOrcamentario = cod.value || '';
    if (fonte) wizardState.fonteRecurso = fonte.value || '';
    if (obs) wizardState.observacoes = obs.value || '';
  }
}

function validate(step) {
  collect(step);
  if (step === 0 && (!wizardState.titulo || !wizardState.coordenacaoId || !wizardState.tipoAtividade)) {
    toast('Preencha os campos obrigatórios.', 'error');
    return false;
  }
  if (step === 1) {
    if (!wizardState.dataInicial || !wizardState.dataFinal) {
      toast('Informe as datas de ida e volta.', 'error');
      return false;
    }
    if (wizardState.dataFinal < wizardState.dataInicial) {
      toast('A data de volta deve ser igual ou posterior à data de ida.', 'error');
      return false;
    }
    if (!wizardState.municipioIds?.length) {
      toast('Adicione pelo menos um município.', 'error');
      return false;
    }
  }
  if (step === 2) {
    const eq = wizardState.equipe || [];
    if (!eq.length) {
      toast('Adicione pelo menos um participante na equipe.', 'error');
      return false;
    }
  }
  return true;
}

function validateForSubmit() {
  if (!validate(0)) { goTo(0); return false; }
  if (!validate(1)) { goTo(1); return false; }
  if (!validate(2)) { goTo(2); return false; }
  collect(3);
  collect(4);
  wizardState = normalizeWizardState(wizardState);
  return true;
}

function refreshMunicipioSection() {
  document.getElementById('wizard-content').innerHTML = renderStep(1);
  bindStep();
}

function goTo(step) {
  currentStep = step;
  document.querySelector('.wizard-steps').outerHTML = renderSteps();
  document.getElementById('wizard-content').innerHTML = renderStep(step);
  const right = document.querySelector('.wizard-actions-right');
  if (right) {
    right.innerHTML = `
      ${currentStep > 0 ? '<button type="button" class="btn btn-ghost" id="wizard-prev">← Anterior</button>' : ''}
      <button type="button" class="btn btn-outline" id="wizard-save">Salvar rascunho</button>
      <button type="button" class="btn btn-primary" id="wizard-next">${currentStep === 4 ? 'Enviar para Aprovação' : 'Próximo →'}</button>`;
  }
  bindStep();
}

function bindStep() {
  document.getElementById('f-data-ini')?.addEventListener('change', updateCronogramaFromDates);
  document.getElementById('f-data-fim')?.addEventListener('change', updateCronogramaFromDates);

  document.getElementById('f-municipio-add')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('outros-nome-wrap');
    if (!wrap) return;
    wrap.classList.toggle('hidden', e.target.value !== MUNICIPIO_OUTROS_ID);
  });

  document.getElementById('btn-add-regional')?.addEventListener('click', () => {
    const id = document.getElementById('f-regional-add')?.value;
    if (!id) return toast('Selecione uma regional.', 'error');
    wizardState.regionalIds = wizardState.regionalIds || [];
    if (!wizardState.regionalIds.includes(id)) wizardState.regionalIds.push(id);
    wizardState.regionalId = wizardState.regionalIds[0] || '';
    refreshMunicipioSection();
  });

  document.getElementById('btn-add-municipio')?.addEventListener('click', () => {
    let id = document.getElementById('f-municipio-add')?.value;
    if (!id) return toast('Selecione um município.', 'error');
    if (id === MUNICIPIO_OUTROS_ID) {
      const nome = document.getElementById('f-municipio-outros-nome')?.value?.trim() || '';
      id = nome ? `outros:${encodeURIComponent(nome)}` : MUNICIPIO_OUTROS_ID;
    }
    wizardState.municipioIds = wizardState.municipioIds || [];
    if (wizardState.municipioIds.includes(id)) {
      return toast('Este município já foi adicionado.', 'error');
    }
    wizardState.municipioIds.push(id);
    wizardState.municipioId = wizardState.municipioIds[0] || '';
    refreshMunicipioSection();
  });

  document.getElementById('btn-add-equipe')?.addEventListener('click', () => {
    const n = document.getElementById('eq-nome')?.value.trim();
    const c = document.getElementById('eq-cargo')?.value.trim();
    if (!n || !c) return toast('Informe nome e cargo.', 'error');
    wizardState.equipe = wizardState.equipe || [];
    wizardState.equipe.push({ nome: n, cargo: c });
    document.getElementById('wizard-content').innerHTML = renderStep(2);
    bindStep();
  });
  document.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    wizardState.equipe.splice(Number(b.dataset.rm), 1);
    document.getElementById('wizard-content').innerHTML = renderStep(2);
    bindStep();
  }));
  document.querySelectorAll('.wizard-step').forEach((el) => el.addEventListener('click', () => {
    if (Number(el.dataset.step) <= currentStep) goTo(Number(el.dataset.step));
  }));

  if (currentStep === 1) updateCronogramaFromDates();
}

let wizardSubmitting = false;

async function persist(status) {
  collect(currentStep);
  wizardState = normalizeWizardState(wizardState);
  if (!wizardState.responsavel && wizardState.equipe?.length) {
    wizardState.responsavel = wizardState.equipe[0].nome;
  }
  const saved = await saveProgramacao({ ...wizardState, status, criadoPor: wizardState.criadoPor }, editId);
  if (saved?.atualizadoEm) wizardState.baseAtualizadoEm = saved.atualizadoEm;
  syncLogisticaFromProgramacao(saved);
  return saved;
}

function bindMain() {
  const actions = document.querySelector('.wizard-actions');
  const content = document.getElementById('wizard-content');
  if (!actions || actions.dataset.bound) return;
  actions.dataset.bound = '1';

  content?.addEventListener('click', (e) => {
    const rmMun = e.target.closest('[data-rm-mun]');
    if (rmMun && currentStep === 1) {
      const id = rmMun.dataset.rmMun;
      wizardState.municipioIds = (wizardState.municipioIds || []).filter((item) => item !== id);
      wizardState.municipioId = wizardState.municipioIds[0] || '';
      refreshMunicipioSection();
      return;
    }
    const rmReg = e.target.closest('[data-rm-reg]');
    if (rmReg && currentStep === 1) {
      const id = rmReg.dataset.rmReg;
      wizardState.regionalIds = (wizardState.regionalIds || []).filter((item) => item !== id);
      wizardState.regionalId = wizardState.regionalIds[0] || '';
      refreshMunicipioSection();
    }
  });

  actions.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn?.id) return;

    if (btn.id === 'wizard-cancel') {
      resetWizardSession();
      window.location.hash = 'programacoes';
      return;
    }
    if (btn.id === 'wizard-prev') {
      collect(currentStep);
      goTo(currentStep - 1);
      return;
    }
    if (btn.id === 'wizard-save') {
      if (wizardSubmitting) return;
      wizardSubmitting = true;
      try {
        await persist('Rascunho');
        toast('Rascunho salvo!', 'success');
      } catch (err) {
        console.error(err);
        toast(err.message || 'Erro ao salvar rascunho.', 'error');
      } finally {
        wizardSubmitting = false;
      }
      return;
    }
    if (btn.id === 'wizard-next') {
      if (wizardSubmitting) return;
      if (!validate(currentStep)) return;
      if (currentStep < 4) {
        goTo(currentStep + 1);
        return;
      }
      if (!validateForSubmit()) return;
      wizardSubmitting = true;
      try {
        await persist('Enviada para Gerência');
        toast('Enviada para a Gerência!', 'success');
        resetWizardSession();
        window.location.hash = 'programacoes';
      } catch (err) {
        console.error(err);
        toast(err.message || 'Erro ao enviar programação. Tente novamente.', 'error');
      } finally {
        wizardSubmitting = false;
      }
    }
  });
}

export function bindNovaProgramacao() { bindStep(); bindMain(); }
