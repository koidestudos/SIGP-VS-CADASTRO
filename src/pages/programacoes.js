import { getProgramacoes, removeProgramacao, approveProgramacao, getProgramacaoById, updateProgramacaoStatus } from '../services/programacoes-service.js';
import { canApprove, canDeleteProgramacao, canEditProgramacao, isAdmin } from '../services/roles.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, COORDENACOES, GERENCIAS, STATUS_PROGRAMACAO,
} from '../data/seed.js';
import { normalizeStatus } from '../utils/status.js';
import { showModal, confirmDialog, toast, renderActionButtons } from '../components/ui.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';
import { downloadProgramacaoPdf, downloadProgramacoesListPdf } from '../utils/programacao-report-pdf.js';
import {
  filterProgramacoes, readFilterState, toggleFilterPanels, getFilterDescription,
} from '../utils/programacoes-filters.js';

export function renderProgramacoes(user) {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return `
    <div class="page-header">
      <h2>Programações</h2>
      <button class="btn btn-primary" id="btn-nova">+ Nova Programação</button>
    </div>
    <div class="filters-bar filters-bar-prog">
      <div class="form-group"><label>Período</label>
        <select class="form-control" id="filtro-periodo-tipo">
          <option value="todas" selected>Todas</option>
          <option value="intervalo">De / até (datas)</option>
          <option value="semana">Semana do mês</option>
          <option value="mes">Mês inteiro</option>
        </select>
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-intervalo-panel">
        <label>De</label>
        <input type="date" class="form-control" id="filtro-data-ini" />
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-intervalo-panel-fim">
        <label>Até</label>
        <input type="date" class="form-control" id="filtro-data-fim" />
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-semana-panel">
        <label>Mês de referência</label>
        <input type="month" class="form-control" id="filtro-semana-mes" value="${mesAtual}" />
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-semana-panel-num">
        <label>Semana</label>
        <select class="form-control" id="filtro-semana-num">
          <option value="1">1ª Semana</option>
          <option value="2">2ª Semana</option>
          <option value="3">3ª Semana</option>
          <option value="4">4ª Semana</option>
          <option value="5">5ª Semana</option>
        </select>
      </div>
      <div class="form-group filtro-panel hidden" id="filtro-mes-panel">
        <label>Mês</label>
        <input type="month" class="form-control" id="filtro-mes" value="${mesAtual}" />
      </div>
      <div class="form-group flex-2"><label>Buscar</label>
        <input type="search" class="form-control" id="filtro-busca" placeholder="Título, município, equipe..." /></div>
      <div class="form-group"><label>Gerência</label><select class="form-control" id="filtro-gerencia"><option value="">Todas</option>
        ${GERENCIAS.map((g) => `<option value="${g}">${g}</option>`).join('')}</select></div>
      <div class="form-group"><label>Coordenação</label><select class="form-control" id="filtro-coord"><option value="">Todas</option>
        ${COORDENACOES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label><select class="form-control" id="filtro-status"><option value="">Todos</option>
        <option>Rascunho</option><option>Pendente</option><option>Programada</option><option>Autorizado</option></select></div>
      <div class="form-group">
        <label>&nbsp;</label>
        <button type="button" class="btn btn-outline btn-sm" id="btn-download-filtro">⬇ Baixar relatório do filtro</button>
      </div>
    </div>
    <p class="text-sm text-muted mb-2" id="filtro-resumo">Exibindo todas as programações</p>
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
    const mun = getMunicipioById(p.municipioId);
    const ger = getGerenciaByProgramacao(p);
    const canEdit = canEditProgramacao(user, p);
    const approve = canApprove(user) && p.status === 'Pendente'
      ? `<button class="btn-icon" data-action="approve" data-id="${p.id}" title="Autorizar / Programar">✔</button>`
      : '';
    const statusCell = isAdmin(user)
      ? `<select class="form-control status-select" data-status-id="${p.id}" style="min-width:120px;padding:2px 6px;font-size:0.75rem">
          ${STATUS_PROGRAMACAO.map((s) => `<option value="${s}" ${normalizeStatus(p.status) === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>`
      : `<span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span>`;
    return `<tr>
      <td>${p.titulo}</td>
      <td><span class="gerencia-tag gerencia-${ger.toLowerCase()}">${ger}</span></td>
      <td>${coord?.nome || '—'}</td><td>${mun?.nome || '—'}</td>
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
    title: 'Definir status da programação',
    body: '<p>Como deseja registrar esta programação pendente?</p>',
    footer: `
      <button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
      <button class="btn btn-outline" data-modal-action="programada">Programada</button>
      <button class="btn btn-primary" data-modal-action="autorizado">Autorizada</button>`,
  });
  if (action === 'programada') {
    await approveProgramacao(id, 'Programada');
    toast('Programação marcada como Programada.', 'success');
  } else if (action === 'autorizado') {
    await approveProgramacao(id, 'Autorizado');
    toast('Programação autorizada!', 'success');
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

  toggleFilterPanels();

  document.getElementById('filtro-periodo-tipo')?.addEventListener('change', () => {
    toggleFilterPanels();
    refresh();
  });

  [
    'filtro-data-ini', 'filtro-data-fim', 'filtro-semana-mes', 'filtro-semana-num',
    'filtro-mes', 'filtro-coord', 'filtro-status', 'filtro-gerencia',
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', refresh);
  });
  document.getElementById('filtro-busca')?.addEventListener('input', refresh);

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
    if (!sel || !isAdmin(user)) return;
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
