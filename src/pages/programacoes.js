import { getProgramacoes, removeProgramacao, approveProgramacao, getProgramacaoById } from '../services/programacoes-service.js';
import { canApprove, canDeleteProgramacao, canEditProgramacao } from '../services/roles.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, COORDENACOES, GERENCIAS,
} from '../data/seed.js';
import { normalizeStatus } from '../utils/status.js';
import { showModal, confirmDialog, toast, renderActionButtons } from '../components/ui.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';

export function renderProgramacoes(user) {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return `
    <div class="page-header">
      <h2>Programações</h2>
      <button class="btn btn-primary" id="btn-nova">+ Nova Programação</button>
    </div>
    <div class="filters-bar">
      <div class="form-group flex-2"><label>Buscar</label>
        <input type="search" class="form-control" id="filtro-busca" placeholder="Título, município, equipe..." /></div>
      <div class="form-group"><label>Gerência</label><select class="form-control" id="filtro-gerencia"><option value="">Todas</option>
        ${GERENCIAS.map((g) => `<option value="${g}">${g}</option>`).join('')}</select></div>
      <div class="form-group"><label>Mês</label><input type="month" class="form-control" id="filtro-mes" value="${mesAtual}" /></div>
      <div class="form-group"><label>Coordenação</label><select class="form-control" id="filtro-coord"><option value="">Todas</option>
        ${COORDENACOES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label><select class="form-control" id="filtro-status"><option value="">Todos</option>
        <option>Rascunho</option><option>Pendente</option><option>Programada</option><option>Autorizado</option></select></div>
    </div>
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
    return `<tr>
      <td>${p.titulo}</td>
      <td><span class="gerencia-tag gerencia-${ger.toLowerCase()}">${ger}</span></td>
      <td>${coord?.nome || '—'}</td><td>${mun?.nome || '—'}</td>
      <td>${formatDate(p.dataInicial)}</td><td>${formatDate(p.dataFinal)}</td>
      <td>${equipeLabel(p)}</td>
      <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td>
      <td>${renderActionButtons(p.id, {
        edit: canEdit,
        del: canDeleteProgramacao(user, p),
        extra: approve + (canEdit ? `<button class="btn-icon" data-action="duplicate" data-id="${p.id}" title="Duplicar">📋</button>` : ''),
      })}</td>
    </tr>`;
  }).join('');
}

function applyFilters() {
  let items = getProgramacoes();
  const busca = document.getElementById('filtro-busca')?.value?.toLowerCase().trim();
  const gerencia = document.getElementById('filtro-gerencia')?.value;
  const mes = document.getElementById('filtro-mes')?.value;
  const coord = document.getElementById('filtro-coord')?.value;
  const status = document.getElementById('filtro-status')?.value;

  if (busca) {
    items = items.filter((p) => {
      const mun = getMunicipioById(p.municipioId)?.nome || '';
      const coordNome = getCoordenacaoById(p.coordenacaoId)?.nome || '';
      const eq = (p.equipe || []).map((e) => e.nome).join(' ');
      return [p.titulo, p.responsavel, p.objetivo, mun, coordNome, eq].join(' ').toLowerCase().includes(busca);
    });
  }
  if (gerencia) items = items.filter((p) => getGerenciaByProgramacao(p) === gerencia);
  if (mes) items = items.filter((p) => p.dataInicial?.startsWith(mes));
  if (coord) items = items.filter((p) => p.coordenacaoId === coord);
  if (status) {
    items = items.filter((p) => normalizeStatus(p.status) === status);
  }
  return items;
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
    const tbody = document.querySelector('#tabela-programacoes tbody');
    if (tbody) tbody.innerHTML = renderRows(applyFilters(), user);
  };
  ['filtro-mes', 'filtro-coord', 'filtro-status', 'filtro-gerencia'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', refresh);
  });
  document.getElementById('filtro-busca')?.addEventListener('input', refresh);
  document.getElementById('btn-nova')?.addEventListener('click', () => { window.location.hash = 'nova-programacao'; });
  document.getElementById('tabela-programacoes')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;
    const prog = getProgramacaoById(id);
    if (action === 'view') showProgramacaoDetail(prog);
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
