import { getCollection, addItem, updateItem, deleteItem, canEdit } from '../services/storage.js';
import { COORDENACOES, generateId } from '../data/seed.js';
import { confirmDialog, toast } from '../components/ui.js';

export function renderEquipes(user) {
  const equipes = getCollection('equipes');
  const edit = canEdit(user);

  return `
    <div class="page-header">
      <h2>Equipes</h2>
      ${edit ? `<button class="btn btn-primary btn-sm" id="btn-add-membro">➕ Adicionar membro</button>` : ''}
    </div>
    <p class="text-muted mb-3">Cadastro único de equipes — evita retrabalho entre programações.</p>
    <div class="card">
      <div class="card-body">
        <div class="table-wrapper">
          <table id="tabela-equipes">
            <thead>
              <tr><th>Nome</th><th>Cargo</th><th>Coordenação</th>${edit ? '<th>Ações</th>' : ''}</tr>
            </thead>
            <tbody>
              ${equipes.map((e) => {
                const coord = COORDENACOES.find((c) => c.id === e.coordenacaoId);
                return `
                  <tr>
                    <td>${e.nome}</td>
                    <td>${e.cargo}</td>
                    <td>${coord?.sigla || 'Geral'}</td>
                    ${edit ? `
                      <td>
                        <button class="btn-icon" data-edit-equipe="${e.id}">✏</button>
                        <button class="btn-icon danger" data-del-equipe="${e.id}">🗑</button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    ${edit ? `
      <div id="form-equipe" class="card mt-3 hidden">
        <div class="card-header"><h3 id="form-equipe-title">Novo membro</h3></div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label>Nome *</label>
              <input type="text" class="form-control" id="eq-nome" />
            </div>
            <div class="form-group">
              <label>Cargo *</label>
              <input type="text" class="form-control" id="eq-cargo" />
            </div>
            <div class="form-group">
              <label>Coordenação</label>
              <select class="form-control" id="eq-coord">
                <option value="">Geral</option>
                ${COORDENACOES.map((c) => `<option value="${c.id}">${c.sigla} — ${c.nome}</option>`).join('')}
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-equipe">Salvar</button>
          <button class="btn btn-ghost btn-sm" id="btn-cancel-equipe">Cancelar</button>
        </div>
      </div>
    ` : ''}
  `;
}

let editingEquipeId = null;

export function bindEquipes(user) {
  if (!canEdit(user)) return;

  const form = document.getElementById('form-equipe');

  document.getElementById('btn-add-membro')?.addEventListener('click', () => {
    editingEquipeId = null;
    document.getElementById('form-equipe-title').textContent = 'Novo membro';
    document.getElementById('eq-nome').value = '';
    document.getElementById('eq-cargo').value = '';
    document.getElementById('eq-coord').value = user.coordenacaoId || '';
    form.classList.remove('hidden');
  });

  document.getElementById('btn-cancel-equipe')?.addEventListener('click', () => {
    form.classList.add('hidden');
  });

  document.getElementById('btn-save-equipe')?.addEventListener('click', () => {
    const nome = document.getElementById('eq-nome').value.trim();
    const cargo = document.getElementById('eq-cargo').value.trim();
    const coordenacaoId = document.getElementById('eq-coord').value || null;
    if (!nome || !cargo) { toast('Preencha nome e cargo.', 'error'); return; }

    if (editingEquipeId) {
      updateItem('equipes', editingEquipeId, { nome, cargo, coordenacaoId });
      toast('Membro atualizado.', 'success');
    } else {
      addItem('equipes', { id: generateId('e'), nome, cargo, coordenacaoId });
      toast('Membro adicionado.', 'success');
    }
    window.location.hash = 'equipes';
  });

  document.querySelectorAll('[data-edit-equipe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const e = getCollection('equipes').find((x) => x.id === btn.dataset.editEquipe);
      editingEquipeId = e.id;
      document.getElementById('form-equipe-title').textContent = 'Editar membro';
      document.getElementById('eq-nome').value = e.nome;
      document.getElementById('eq-cargo').value = e.cargo;
      document.getElementById('eq-coord').value = e.coordenacaoId || '';
      form.classList.remove('hidden');
    });
  });

  document.querySelectorAll('[data-del-equipe]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const result = await confirmDialog('Excluir este membro da equipe?');
      if (result === 'confirm') {
        deleteItem('equipes', btn.dataset.delEquipe);
        toast('Membro excluído.', 'success');
        window.location.hash = 'equipes';
      }
    });
  });
}
