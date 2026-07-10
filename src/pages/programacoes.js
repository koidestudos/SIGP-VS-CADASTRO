import { getProgramacoes, removeProgramacao, approveProgramacao, rejectProgramacao, getProgramacaoById, updateProgramacaoStatus } from '../services/programacoes-service.js';
import { canApprove, canDeleteProgramacao, canEditProgramacao, isAdmin } from '../services/roles.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, getMunicipiosLabel,
} from '../data/seed.js';
import { normalizeStatus, getStatusOptionsForUser, needsApproval, STATUS_PROGRAMACAO } from '../utils/status.js';
import { showModal, confirmDialog, toast, renderActionButtons } from '../components/ui.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';
import { downloadProgramacaoPdf, downloadProgramacoesListPdf } from '../utils/programacao-report-pdf.js';
import {
  filterProgramacoes, readFilterState, getFilterDescription,
  renderProgramacoesFilterBar, bindProgramacoesFilterBar,
} from '../utils/programacoes-filters.js';

export function renderProgramacoes(user) {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return `
    <div class="page-header">
      <h2>Programações</h2>
      <button class="btn btn-primary" id="btn-nova">+ Nova Programação</button>
    </div>
    ${renderProgramacoesFilterBar({
      mesAtual,
      showPdfButton: true,
      statusOptions: STATUS_PROGRAMACAO,
    })}
    <div class="card"><div class="card-body"><div class="table-wrapper">
      <table id="tabela-programacoes"><thead><tr>
        <th>Ação</th><th>Gerência</th><th>Coordenação</th><th>Município</th><th>Data Ida</th><th>Data Volta</th><th>Equipe</th><th>Status</th><th>Ações</th>
      </tr></thead><tbody>${renderRows(getProgramacoes(), user)}</tbody></table>
    </div></div></div>`;
}

function equipeLabel(p) {
  const eq = (p.equipe || []).map((e) => e.nome).filter(Boolean);
  if (eq.length) return eq.slice(0, 2).join(', ') + (eq.length > 2 ? '…' : '');
  return p.responsavel || '—';
}

function renderRows(items, user) {
  if (!items.length) return '<tr><td colspan="9" class="text-center text-muted">Nenhuma programação.</td></tr>';
  return items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const munLabel = getMunicipiosLabel(p);
    const ger = getGerenciaByProgramacao(p);
    const canEdit = canEditProgramacao(user, p);
    const approve = canApprove(user) && needsApproval(p.status)
      ? `<button class="btn-icon" data-action="approve" data-id="${p.id}" title="Analisar programação">✔</button>`
      : '';
    const statusOptions = getStatusOptionsForUser(user, p);
    const canChangeStatus = isAdmin(user) || (canEdit && statusOptions.length > 1);
    const statusCell = canChangeStatus
      ? `<select class="form-control status-select" data-status-id="${p.id}" style="min-width:120px;padding:2px 6px;font-size:0.75rem">
          ${statusOptions.map((s) => `<option value="${s}" ${normalizeStatus(p.status) === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>`
      : `<span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span>`;
    return `<tr>
      <td>${p.titulo}</td>
      <td><span class="gerencia-tag gerencia-${ger.toLowerCase()}">${ger}</span></td>
      <td>${coord?.nome || '—'}</td><td>${munLabel}</td>
      <td>${formatDate(p.dataInicial)}</td><td>${formatDate(p.dataFinal)}</td>
      <td>${equipeLabel(p)}</td>
      <td>${statusCell}</td>
      <td>${renderActionButtons(p.id, {
        edit: canEdit,
        del: canDeleteProgramacao(user, p),
        extra: `<button class="btn-icon" data-action="pdf" data-id="${p.id}" title="Baixar PDF">📄</button>`
          + approve + (canEdit ? `<button class="btn-icon" data-action="duplicate" data-id="${p.id}" title="Duplicar">📋</button>` : ''),
      })}</td>
    </tr>`;
  }).join('');
}

async function showApproveDialog(id) {
  const action = await showModal({
    title: 'Analisar programação',
    body: '<p>Como deseja registrar esta programação enviada pela coordenação?</p>',
    footer: `
      <button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
      <button class="btn btn-outline" data-modal-action="programada">Programada</button>
      <button class="btn btn-outline" data-modal-action="reprovar">Reprovar</button>
      <button class="btn btn-primary" data-modal-action="autorizar">Autorizar</button>`,
  });
  if (action === 'programada') {
    await updateProgramacaoStatus(id, 'Programada');
    toast('Programação marcada como Programada.', 'success');
  } else if (action === 'reprovar') {
    await rejectProgramacao(id);
    toast('Programação reprovada.', 'success');
  } else if (action === 'autorizar') {
    await approveProgramacao(id);
    toast('Programação autorizada! Aparecerá no Dashboard e no BI.', 'success');
  }
}

export function bindProgramacoes(user) {
  const refresh = () => {
    const items = filterProgramacoes(getProgramacoes());
    const tbody = document.querySelector('#tabela-programacoes tbody');
    if (tbody) tbody.innerHTML = renderRows(items, user);
    const resumo = document.getElementById('filtro-resumo');
    if (resumo) {
      const desc = getFilterDescription();
      resumo.textContent = `${desc} — ${items.length} programação(ões)`;
    }
  };

  bindProgramacoesFilterBar(refresh);

  document.getElementById('btn-download-filtro')?.addEventListener('click', () => {
    const state = readFilterState();
    const items = filterProgramacoes(getProgramacoes(), state);
    if (state.tipo === 'intervalo' && (!state.dataIni || !state.dataFim)) {
      toast('Informe as datas De e Até.', 'error');
      return;
    }
    if (state.tipo === 'semana' && !state.semanaMes) {
      toast('Informe o mês de referência da semana.', 'error');
      return;
    }
    if (state.tipo === 'mes' && !state.mes) {
      toast('Informe o mês.', 'error');
      return;
    }
    try {
      downloadProgramacoesListPdf(items, {
        title: getFilterDescription(state),
        subtitle: [state.gerencia, state.status].filter(Boolean).join(' · ') || undefined,
      });
      toast(`PDF com ${items.length} programação(ões) gerado.`, 'success');
    } catch (err) {
      toast(err.message || 'Erro ao gerar PDF.', 'error');
    }
  });

  document.getElementById('btn-nova')?.addEventListener('click', () => { window.location.hash = 'nova-programacao'; });
  document.getElementById('tabela-programacoes')?.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status-id]');
    if (!sel || !(isAdmin(user) || canEditProgramacao(user, getProgramacaoById(sel.dataset.statusId)))) return;
    try {
      await updateProgramacaoStatus(sel.dataset.statusId, sel.value);
      toast('Status atualizado.', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao atualizar status.', 'error');
    }
  });
  document.getElementById('tabela-programacoes')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;
    const prog = getProgramacaoById(id);
    if (action === 'view') showProgramacaoDetail(prog);
    if (action === 'pdf') {
      try { downloadProgramacaoPdf(prog); toast('PDF gerado.', 'success'); }
      catch (err) { toast(err.message || 'Erro ao gerar PDF.', 'error'); }
    }
    if (action === 'edit') {
      if (!canEditProgramacao(user, prog)) { toast('Você só pode editar suas próprias programações.', 'error'); return; }
      window.location.hash = `nova-programacao/edit/${id}`;
    }
    if (action === 'duplicate') window.location.hash = `nova-programacao/duplicate/${id}`;
    if (action === 'delete' && (await confirmDialog('Excluir programação?')) === 'confirm') {
      await removeProgramacao(id); toast('Excluída.', 'success'); refresh();
    }
    if (action === 'approve') { await showApproveDialog(id); refresh(); }
  });
  refresh();
}
