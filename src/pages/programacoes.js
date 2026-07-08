import { getProgramacoes, removeProgramacao, approveProgramacao, getProgramacaoById } from '../services/programacoes-service.js';
import { canApprove, canDeleteProgramacao } from '../services/roles.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, COORDENACOES, MUNICIPIOS,
} from '../data/seed.js';
import { showModal, confirmDialog, toast, renderActionButtons } from '../components/ui.js';

export function renderProgramacoes(user) {
  const programacoes = getProgramacoes();
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return `
    <div class="page-header">
      <h2>Programações</h2>
      <button class="btn btn-primary" id="btn-nova">+ Nova Programação</button>
    </div>
    <div class="filters-bar">
      <div class="form-group"><label>Mês</label><input type="month" class="form-control" id="filtro-mes" value="${mesAtual}" /></div>
      <div class="form-group"><label>Coordenação</label><select class="form-control" id="filtro-coord"><option value="">Todas</option>
        ${COORDENACOES.map((c) => `<option value="${c.id}">${c.sigla}</option>`).join('')}</select></div>
      <div class="form-group"><label>Município</label><select class="form-control" id="filtro-mun"><option value="">Todos</option>
        ${MUNICIPIOS.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('')}</select></div>
      <div class="form-group"><label>Status</label><select class="form-control" id="filtro-status"><option value="">Todos</option>
        <option>Rascunho</option><option>Pendente</option><option>Publicada</option><option>Concluída</option></select></div>
    </div>
    <div class="card"><div class="card-body"><div class="table-wrapper">
      <table id="tabela-programacoes"><thead><tr>
        <th>Ação</th><th>Gerência</th><th>Coordenação</th><th>Município</th><th>Data Ida</th><th>Data Volta</th><th>Responsável</th><th>Status</th><th>Ações</th>
      </tr></thead><tbody>${renderRows(programacoes, user)}</tbody></table>
    </div></div></div>`;
}

function renderRows(items, user) {
  if (!items.length) return '<tr><td colspan="9" class="text-center text-muted">Nenhuma programação.</td></tr>';
  return items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipioById(p.municipioId);
    const ger = getGerenciaByProgramacao(p);
    const approve = canApprove(user) && p.status === 'Pendente'
      ? `<button class="btn-icon" data-action="approve" data-id="${p.id}" title="Aprovar">✔</button>`
      : '';
    return `<tr>
      <td>${p.titulo}</td>
      <td><span class="gerencia-tag gerencia-${ger.toLowerCase()}">${ger}</span></td>
      <td>${coord?.sigla || '—'}</td><td>${mun?.nome || '—'}</td>
      <td>${formatDate(p.dataInicial)}</td><td>${formatDate(p.dataFinal)}</td>
      <td>${p.responsavel}</td>
      <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
      <td>${renderActionButtons(p.id, { del: canDeleteProgramacao(user, p), extra: approve + `<button class="btn-icon" data-action="duplicate" data-id="${p.id}" title="Duplicar">📋</button>` })}</td>
    </tr>`;
  }).join('');
}

function applyFilters() {
  let items = getProgramacoes();
  const mes = document.getElementById('filtro-mes')?.value;
  const coord = document.getElementById('filtro-coord')?.value;
  const mun = document.getElementById('filtro-mun')?.value;
  const status = document.getElementById('filtro-status')?.value;
  if (mes) items = items.filter((p) => p.dataInicial?.startsWith(mes));
  if (coord) items = items.filter((p) => p.coordenacaoId === coord);
  if (mun) items = items.filter((p) => p.municipioId === mun);
  if (status) items = items.filter((p) => p.status === status);
  return items;
}

export function bindProgramacoes(user) {
  const refresh = () => {
    const tbody = document.querySelector('#tabela-programacoes tbody');
    if (tbody) tbody.innerHTML = renderRows(applyFilters(), user);
  };
  ['filtro-mes', 'filtro-coord', 'filtro-mun', 'filtro-status'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', refresh);
  });
  document.getElementById('btn-nova')?.addEventListener('click', () => { window.location.hash = 'nova-programacao'; });
  document.getElementById('tabela-programacoes')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;
    if (action === 'view') showDetail(getProgramacaoById(id));
    if (action === 'edit') window.location.hash = `nova-programacao/edit/${id}`;
    if (action === 'duplicate') window.location.hash = `nova-programacao/duplicate/${id}`;
    if (action === 'delete' && (await confirmDialog('Excluir programação?')) === 'confirm') {
      await removeProgramacao(id); toast('Excluída.', 'success'); refresh();
    }
    if (action === 'approve') { await approveProgramacao(id); toast('Aprovada e publicada!', 'success'); refresh(); }
  });
  refresh();
}

function showDetail(p) {
  showModal({
    title: p.titulo,
    body: `<div class="detail-grid">
      <div class="detail-item"><label>Gerência</label><span>${getGerenciaByProgramacao(p)}</span></div>
      <div class="detail-item"><label>Data Ida</label><span>${formatDate(p.dataInicial)}</span></div>
      <div class="detail-item"><label>Data Volta</label><span>${formatDate(p.dataFinal)}</span></div>
    </div>`,
    footer: '<button class="btn btn-primary" data-modal-action="close">Fechar</button>',
  });
}
