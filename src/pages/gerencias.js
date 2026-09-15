import { getProgramacoes, approveProgramacaoByGerencia, devolverProgramacaoParaCorrecao, getProgramacaoById } from '../services/programacoes-service.js';
import {
  canViewGerencias, canViewGerenciaTab, canApproveGerencia, canSeeAuthor, isGerencia, isDiretoria, canSeeHistory,
} from '../services/roles.js';
import {
  GERENCIAS_TABS, needsGerenciaApproval, isAprovadaGerencia, isDevolvidaGerencia,
  getStatusBadgeClass, getStatusRowClass, normalizeStatus, STATUS_PROGRAMACAO,
} from '../utils/status.js';
import { getCoordenacaoById, formatDate, getMunicipiosLabel, getGerenciaByProgramacao } from '../data/seed.js';
import { getIncluidoPorLabel } from '../services/users-service.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';
import { confirmDialog, toast, showModal } from '../components/ui.js';
import {
  filterProgramacoes, readFilterState, getFilterDescription,
  renderProgramacoesFilterBar, bindProgramacoesFilterBar,
} from '../utils/programacoes-filters.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatQuando(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function progGerencia(p) {
  return String(p.gerencia || getGerenciaByProgramacao(p) || '').toUpperCase();
}

function extraFiltered(items) {
  const state = readFilterState('gerencias');
  return filterProgramacoes(items, { ...state, gerencia: '' });
}

function listForGerencia(gerencia) {
  return getProgramacoes().filter((p) => progGerencia(p) === gerencia);
}

function filterBySub(items, sub) {
  if (sub === 'pendentes') return items.filter((p) => needsGerenciaApproval(p.status));
  if (sub === 'aprovadas') return items.filter((p) => isAprovadaGerencia(p.status));
  if (sub === 'devolvidas') return items.filter((p) => isDevolvidaGerencia(p.status));
  return items;
}

function allowedTabs(user) {
  return GERENCIAS_TABS.filter((g) => canViewGerenciaTab(user, g));
}

export function renderGerencias(user, params = []) {
  if (!canViewGerencias(user)) {
    return `<div class="card"><div class="card-body">
      <p class="alert alert-error">Você não tem acesso à análise das Gerências.</p>
    </div></div>`;
  }

  const tabs = allowedTabs(user);
  const requested = String(params[0] || '').toUpperCase();
  const activeGer = tabs.includes(requested) ? requested : (tabs[0] || 'GAS');
  const sub = ['pendentes', 'aprovadas', 'devolvidas', 'todas'].includes(params[1]) ? params[1] : 'pendentes';
  const daGerencia = listForGerencia(activeGer);
  const items = extraFiltered(filterBySub(daGerencia, sub));
  const nPend = daGerencia.filter((p) => needsGerenciaApproval(p.status)).length;
  const nAprov = daGerencia.filter((p) => isAprovadaGerencia(p.status)).length;
  const nDev = daGerencia.filter((p) => isDevolvidaGerencia(p.status)).length;

  return `
    <div class="page-header">
      <div>
        <h2>Gerências</h2>
        <p class="text-muted mb-0">Coordenação cadastra → Gerência analisa e aprova → Diretoria acompanha</p>
      </div>
    </div>
    ${isDiretoria(user) && !isGerencia(user) ? `
      <p class="text-sm text-muted mb-3">A Diretoria acompanha as três Gerências. A aprovação inicial é feita pela Gerência responsável.</p>
    ` : ''}
    <div class="tabs gerencia-tabs" id="gerencia-tabs">
      ${tabs.map((g) => {
        const n = listForGerencia(g).filter((p) => needsGerenciaApproval(p.status)).length;
        return `<button class="tab ${activeGer === g ? 'active' : ''}" data-ger-tab="${g}">
          ${g} ${n ? `<span class="ger-pend-badge" title="${n} pendente(s)">🔴 ${n}</span>` : '<span class="ger-pend-ok">0</span>'}
        </button>`;
      }).join('')}
    </div>
    <div class="tabs mt-2" id="gerencia-subtabs">
      <button class="tab ${sub === 'pendentes' ? 'active' : ''}" data-ger-sub="pendentes">Pendentes (${nPend})</button>
      <button class="tab ${sub === 'aprovadas' ? 'active' : ''}" data-ger-sub="aprovadas">Aprovadas (${nAprov})</button>
      <button class="tab ${sub === 'devolvidas' ? 'active' : ''}" data-ger-sub="devolvidas">Devolvidas para correção (${nDev})</button>
      <button class="tab ${sub === 'todas' ? 'active' : ''}" data-ger-sub="todas">Todas (${daGerencia.length})</button>
    </div>
    ${renderProgramacoesFilterBar({
      statusOptions: STATUS_PROGRAMACAO,
      hideGerenciaFilter: true,
      resumoId: 'filtro-ger-resumo',
      storageKey: 'gerencias',
      resumoText: `${isDiretoria(user) && !isGerencia(user) ? 'Filtros da Diretoria (Coordenação + Status + Período) — ' : ''}Exibindo ${items.length} programação(ões)`,
    })}
    <div class="card gerencia-queue-card">
      <div class="card-body" style="padding:0">
        <div class="table-wrapper">
          <table class="prog-table gerencia-table">
            <thead>
              <tr>
                <th>Coordenação</th>
                <th>Programação</th>
                <th>Ação / atividade</th>
                <th>Data prevista</th>
                <th>Município / local</th>
                <th>Envio</th>
                <th>Responsável</th>
                ${canSeeAuthor(user) ? '<th>Incluído por</th>' : ''}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderGerenciaRows(items, user, sub)}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function renderGerenciaRows(items, user, sub) {
  if (!items.length) {
    const empty = sub === 'pendentes'
      ? 'Nenhuma programação aguardando aprovação.'
      : 'Nenhuma programação neste filtro.';
    const cols = canSeeAuthor(user) ? 10 : 9;
    return `<tr><td colspan="${cols}" class="text-center text-muted" style="padding:28px">${empty}</td></tr>`;
  }
  return items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const pendente = needsGerenciaApproval(p.status);
    const autor = getIncluidoPorLabel(p) || '—';
    const envio = p.enviadoEm || p.criadoEm;
    const canAct = pendente && canApproveGerencia(user, p);
    return `<tr class="${getStatusRowClass(p.status)} ${pendente ? 'row-pendente-gerencia' : ''}">
      <td>${esc(coord?.sigla || coord?.nome || '—')}</td>
      <td><strong class="prog-acao" title="${esc(p.titulo)}">${esc(p.titulo) || '—'}</strong></td>
      <td>${esc(p.tipoAtividade) || '—'}</td>
      <td>${formatDate(p.dataInicial)}${p.dataFinal ? ` a ${formatDate(p.dataFinal)}` : ''}</td>
      <td>${esc(getMunicipiosLabel(p))}<br><span class="text-sm text-muted">${esc(p.localAtividade) || ''}</span></td>
      <td>${formatQuando(envio)}</td>
      <td>${esc(p.responsavel) || '—'}</td>
      ${canSeeAuthor(user) ? `<td>${esc(autor)}</td>` : ''}
      <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td>
      <td class="table-actions">
        <button class="btn-icon" data-ger-view="${p.id}" title="Visualizar / analisar">👁</button>
        ${canAct ? `<button class="btn btn-primary btn-sm" data-ger-analisar="${p.id}">Analisar</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function analisarProgramacao(id, user) {
  const p = getProgramacaoById(id);
  if (!p) { toast('Programação não encontrada.', 'error'); return; }
  const canAct = canApproveGerencia(user, p) && needsGerenciaApproval(p.status);
  const action = await showProgramacaoDetail(p, {
    showAuthor: canSeeAuthor(user),
    showHistory: canSeeHistory(user, p),
    footer: canAct
      ? `<button class="btn btn-ghost" data-modal-action="cancel">Fechar</button>
         <button class="btn btn-outline" data-modal-action="devolver">Devolver para correção</button>
         <button class="btn btn-primary" data-modal-action="aprovar">Aprovar</button>`
      : `<button class="btn btn-primary" data-modal-action="close">Fechar</button>`,
  });
  if (action === 'aprovar') {
    if ((await confirmDialog('Aprovar esta programação pela Gerência?')) !== 'confirm') return;
    try {
      await approveProgramacaoByGerencia(id);
      toast('Programação aprovada pela Gerência.', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao aprovar.', 'error');
    }
    return;
  }
  if (action === 'devolver') {
    let justificativa = '';
    const result = await showModal({
      title: 'Devolver para correção',
      body: `<p class="text-sm mb-2">Informe a justificativa. A Coordenação verá esta observação e poderá corrigir e reenviar.</p>
        <div class="form-group"><label>Justificativa *</label>
        <textarea class="form-control" id="ger-justificativa" rows="4" maxlength="2000"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
        <button class="btn btn-primary" data-modal-action="confirm">Devolver</button>`,
      onAction: (act, overlay) => {
        if (act !== 'confirm') return;
        justificativa = overlay.querySelector('#ger-justificativa')?.value.trim() || '';
        if (!justificativa) {
          toast('Informe a justificativa da devolução.', 'error');
          return false;
        }
      },
    });
    if (result !== 'confirm' || !justificativa) return;
    try {
      await devolverProgramacaoParaCorrecao(id, justificativa);
      toast('Programação devolvida para a Coordenação.', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao devolver.', 'error');
    }
  }
}

export function bindGerencias(user, params = []) {
  const tabs = allowedTabs(user);
  const requested = String(params[0] || '').toUpperCase();
  const activeGer = tabs.includes(requested) ? requested : (tabs[0] || 'GAS');
  const sub = ['pendentes', 'aprovadas', 'devolvidas', 'todas'].includes(params[1]) ? params[1] : 'pendentes';

  const refresh = () => {
    const items = extraFiltered(filterBySub(listForGerencia(activeGer), sub));
    const tbody = document.querySelector('.gerencia-table tbody');
    if (tbody) tbody.innerHTML = renderGerenciaRows(items, user, sub);
    const resumo = document.getElementById('filtro-ger-resumo');
    if (resumo) resumo.textContent = `${getFilterDescription(readFilterState('gerencias'))} — ${items.length} programação(ões)`;
  };
  bindProgramacoesFilterBar(refresh, 'gerencias');

  document.getElementById('gerencia-tabs')?.querySelectorAll('[data-ger-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.hash = `gerencias/${btn.dataset.gerTab}/${sub}`;
    });
  });
  document.getElementById('gerencia-subtabs')?.querySelectorAll('[data-ger-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.hash = `gerencias/${activeGer}/${btn.dataset.gerSub}`;
    });
  });
  document.querySelector('.gerencia-queue-card')?.addEventListener('click', async (e) => {
    const view = e.target.closest('[data-ger-view]');
    if (view) {
      await analisarProgramacao(view.dataset.gerView, user);
      return;
    }
    const analisar = e.target.closest('[data-ger-analisar]');
    if (analisar) await analisarProgramacao(analisar.dataset.gerAnalisar, user);
  });
}
