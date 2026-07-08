import { getCollection, updateItem, canEdit } from '../services/storage.js';
import { getMunicipioById, getStatusBadgeClass } from '../data/seed.js';
import { toast } from '../components/ui.js';

export function renderLogistica(user) {
  const logistica = getCollection('logistica');
  const edit = canEdit(user);

  return `
    <div class="page-header"><h2>Logística</h2></div>
    <p class="text-muted mb-3">Solicitações de transporte e alimentação vinculadas às programações.</p>
    <div class="card">
      <div class="card-body">
        <div class="table-wrapper">
          <table id="tabela-logistica">
            <thead>
              <tr><th>Município</th><th>Transporte</th><th>Alimentação</th><th>Situação</th>${edit ? '<th>Ações</th>' : ''}</tr>
            </thead>
            <tbody>
              ${logistica.length ? logistica.map((l) => {
                const mun = getMunicipioById(l.municipioId);
                return `
                  <tr data-id="${l.id}">
                    <td>${mun?.nome || '—'}</td>
                    <td>${l.transporte ? '✔ Transporte' : '✖ Transporte'}</td>
                    <td>${l.alimentacao ? '✔ Alimentação' : '✖ Alimentação'}</td>
                    <td><span class="badge ${getStatusBadgeClass(l.situacao)}">${l.situacao}</span></td>
                    ${edit ? `
                      <td>
                        <select class="form-control btn-sm" data-update-situacao="${l.id}" style="width:auto;padding:4px 8px">
                          <option ${l.situacao === 'Solicitado' ? 'selected' : ''}>Solicitado</option>
                          <option ${l.situacao === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                        </select>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : '<tr><td colspan="5" class="text-center text-muted">Nenhuma solicitação.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function bindLogistica(user) {
  document.querySelectorAll('[data-update-situacao]').forEach((sel) => {
    sel.addEventListener('change', () => {
      updateItem('logistica', sel.dataset.updateSituacao, { situacao: sel.value });
      toast('Situação atualizada.', 'success');
    });
  });
}
