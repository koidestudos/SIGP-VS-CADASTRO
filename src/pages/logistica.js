import { getCollection, updateLogisticaSituacao } from '../services/storage.js';
import { getMunicipioById, getStatusBadgeClass } from '../data/seed.js';
import { toast } from '../components/ui.js';

export function renderLogistica() {
  const logistica = getCollection('logistica');

  return `
    <div class="page-header"><h2>Logística</h2></div>
    <p class="text-muted mb-3">Solicitações de transporte e alimentação vinculadas às programações.</p>
    <div class="card">
      <div class="card-body">
        <div class="table-wrapper">
          <table id="tabela-logistica">
            <thead>
              <tr><th>Município</th><th>Transporte</th><th>Alimentação</th><th>Situação</th><th>Ações</th></tr>
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
                    <td>
                      <select class="form-control btn-sm" data-update-situacao="${l.id}" style="width:auto;padding:4px 8px">
                        <option ${l.situacao === 'Solicitado' ? 'selected' : ''}>Solicitado</option>
                        <option ${l.situacao === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                      </select>
                    </td>
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

export function bindLogistica() {
  document.querySelectorAll('[data-update-situacao]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await updateLogisticaSituacao(sel.dataset.updateSituacao, sel.value);
        toast('Situação atualizada.', 'success');
      } catch (err) {
        toast(err.message || 'Erro ao atualizar.', 'error');
      }
    });
  });
}
