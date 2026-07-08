import { getCollection, deleteItem, canEdit, canApprove, approveProgramacao, getItemById } from '../services/storage.js';
import { getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass, COORDENACOES, MUNICIPIOS } from '../data/seed.js';
import { showModal, confirmDialog, toast, renderActionButtons } from '../components/ui.js';

export function renderProgramacoes(user) {
  const programacoes = getCollection('programacoes');
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return `
    <div class="page-header">
      <h2>Programações</h2>
      ${canEdit(user) ? `<button class="btn btn-primary" id="btn-nova">➕ Nova Programação</button>` : ''}
    </div>

    <div class="filters-bar" id="filtros-programacoes">
      <div class="form-group">
        <label>Mês</label>
        <input type="month" class="form-control" id="filtro-mes" value="${mesAtual}" />
      </div>
      <div class="form-group">
        <label>Coordenação</label>
        <select class="form-control" id="filtro-coord">
          <option value="">Todas</option>
          ${COORDENACOES.map((c) => `<option value="${c.id}">${c.sigla} — ${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Município</label>
        <select class="form-control" id="filtro-mun">
          <option value="">Todos</option>
          ${MUNICIPIOS.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="filtro-status">
          <option value="">Todos</option>
          <option>Rascunho</option>
          <option>Pendente</option>
          <option>Aprovada</option>
          <option>Publicada</option>
          <option>Concluída</option>
          <option>Cancelada</option>
        </select>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-limpar-filtros">Limpar</button>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-wrapper">
          <table id="tabela-programacoes">
            <thead>
              <tr>
                <th>Ação</th><th>Coordenação</th><th>Município</th><th>Data</th><th>Responsável</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>${renderRows(programacoes, user)}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderRows(programacoes, user) {
  if (!programacoes.length) {
    return '<tr><td colspan="7" class="text-center text-muted">Nenhuma programação encontrada.</td></tr>';
  }

  return programacoes.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const mun = getMunicipioById(p.municipioId);
    const edit = canEdit(user);
    const approveBtn = canApprove(user) && p.status === 'Pendente'
      ? `<button class="btn-icon" title="Aprovar" data-action="approve" data-id="${p.id}">✔</button>`
      : '';
    const dupBtn = edit
      ? `<button class="btn-icon" title="Duplicar" data-action="duplicate" data-id="${p.id}">📋</button>`
      : '';
    return `
      <tr>
        <td>${p.titulo}</td>
        <td>${coord?.sigla || '—'}</td>
        <td>${mun?.nome || '—'}</td>
        <td>${formatDate(p.dataInicial)}</td>
        <td>${p.responsavel}</td>
        <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td>
        <td>${renderActionButtons(p.id, { edit, del: edit, extra: approveBtn + dupBtn })}</td>
      </tr>
    `;
  }).join('');
}

function applyFilters() {
  let items = getCollection('programacoes');
  const mes = document.getElementById('filtro-mes')?.value;
  const coord = document.getElementById('filtro-coord')?.value;
  const mun = document.getElementById('filtro-mun')?.value;
  const status = document.getElementById('filtro-status')?.value;

  if (mes) {
    items = items.filter((p) => p.dataInicial.startsWith(mes));
  }
  if (coord) items = items.filter((p) => p.coordenacaoId === coord);
  if (mun) items = items.filter((p) => p.municipioId === mun);
  if (status) items = items.filter((p) => p.status === status);

  return items;
}

function refreshTable(user) {
  const tbody = document.querySelector('#tabela-programacoes tbody');
  if (tbody) tbody.innerHTML = renderRows(applyFilters(), user);
}

function showProgramacaoDetail(p) {
  const coord = getCoordenacaoById(p.coordenacaoId);
  const mun = getMunicipioById(p.municipioId);

  showModal({
    title: p.titulo,
    size: 'modal-lg',
    body: `
      <div class="detail-grid">
        <div class="detail-item"><label>Tipo</label><span>${p.tipoAtividade}</span></div>
        <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
        <div class="detail-item"><label>Responsável</label><span>${p.responsavel}</span></div>
        <div class="detail-item"><label>Município</label><span>${mun?.nome || '—'}</span></div>
        <div class="detail-item"><label>Período</label><span>${formatDate(p.dataInicial)} — ${formatDate(p.dataFinal)}</span></div>
        <div class="detail-item"><label>Status</label><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></div>
        <div class="detail-item"><label>Objetivo</label><span>${p.objetivo || '—'}</span></div>
        <div class="detail-item"><label>Público-alvo</label><span>${p.publicoAlvo || '—'}</span></div>
        <div class="detail-item"><label>Transporte</label><span>${p.necessitaTransporte ? 'Sim' : 'Não'}</span></div>
        <div class="detail-item"><label>Alimentação</label><span>${p.necessitaAlimentacao ? 'Sim' : 'Não'}</span></div>
      </div>
      ${p.equipe?.length ? `
        <h4 class="mt-3 section-title">Equipe</h4>
        <table><thead><tr><th>Nome</th><th>Cargo</th></tr></thead>
        <tbody>${p.equipe.map((e) => `<tr><td>${e.nome}</td><td>${e.cargo}</td></tr>`).join('')}</tbody></table>
      ` : ''}
    `,
    footer: `<button class="btn btn-primary" data-modal-action="close">Fechar</button>`,
  });
}

export function bindProgramacoes(user) {
  const refresh = () => refreshTable(user);

  ['filtro-mes', 'filtro-coord', 'filtro-mun', 'filtro-status'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', refresh);
  });

  document.getElementById('btn-limpar-filtros')?.addEventListener('click', () => {
    document.getElementById('filtro-coord').value = '';
    document.getElementById('filtro-mun').value = '';
    document.getElementById('filtro-status').value = '';
    refresh();
  });

  document.getElementById('btn-nova')?.addEventListener('click', () => {
    window.location.hash = 'nova-programacao';
  });

  document.getElementById('tabela-programacoes')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const p = getItemById('programacoes', id);

    if (action === 'view') showProgramacaoDetail(p);
    if (action === 'edit') window.location.hash = `nova-programacao/edit/${id}`;
    if (action === 'duplicate') window.location.hash = `nova-programacao/duplicate/${id}`;
    if (action === 'delete') {
      const result = await confirmDialog('Deseja excluir esta programação?');
      if (result === 'confirm') {
        deleteItem('programacoes', id);
        toast('Programação excluída.', 'success');
        refresh();
      }
    }
    if (action === 'approve') {
      approveProgramacao(id);
      toast('Programação aprovada e publicada no calendário!', 'success');
      refresh();
    }
  });

  refresh();
}
