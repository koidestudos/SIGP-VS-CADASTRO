import { getCollection, updateLogisticaSituacao } from '../services/storage.js';
import { getProgramacaoRawById } from '../services/programacoes-service.js';
import { getMunicipioById, getStatusBadgeClass, formatDate, getGerenciaByProgramacao } from '../data/seed.js';
import { toast } from '../components/ui.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';
import { downloadProgramacaoPdf } from '../utils/programacao-report-pdf.js';

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
              <tr><th>Programação</th><th>Gerência</th><th>Município</th><th>Transporte</th><th>Alimentação</th><th>Situação</th><th>Ações</th></tr>
            </thead>
            <tbody>
              ${logistica.length ? logistica.map((l) => {
                const prog = getProgramacaoRawById(l.programacaoId);
                return `
                  <tr data-id="${l.id}">
                    <td class="td-action">${prog?.titulo || '—'}
                      ${prog ? `<br><span class="text-sm text-muted">${formatDate(prog.dataInicial)} — ${formatDate(prog.dataFinal)}</span>` : ''}</td>
                    <td>${prog ? `<span class="gerencia-tag gerencia-${getGerenciaByProgramacao(prog).toLowerCase()}">${getGerenciaByProgramacao(prog)}</span>` : '—'}</td>
                    <td>${getMunicipioById(l.municipioId || prog?.municipioId)?.nome || '—'}</td>
                    <td>${l.transporte ? '✔ Sim' : '✖ Não'}</td>
                    <td>${l.alimentacao ? '✔ Sim' : '✖ Não'}</td>
                    <td><span class="badge ${getStatusBadgeClass(l.situacao)}">${l.situacao}</span></td>
                    <td>
                      <div class="table-actions">
                        ${prog ? `<button class="btn-icon" title="Visualizar programação" data-view-prog="${l.programacaoId}">👁</button>` : ''}
                        ${prog ? `<button class="btn-icon" title="Baixar PDF" data-pdf-prog="${l.programacaoId}">📄</button>` : ''}
                        <select class="form-control btn-sm" data-update-situacao="${l.id}" style="width:auto;padding:4px 8px">
                          <option ${l.situacao === 'Solicitado' ? 'selected' : ''}>Solicitado</option>
                          <option ${l.situacao === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                        </select>
                      </div>
                    </td>
                  </tr>`;
              }).join('') : '<tr><td colspan="7" class="text-center text-muted">Nenhuma solicitação.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

export function bindLogistica() {
  document.querySelectorAll('[data-view-prog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prog = getProgramacaoRawById(btn.dataset.viewProg);
      showProgramacaoDetail(prog);
    });
  });
  document.querySelectorAll('[data-pdf-prog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prog = getProgramacaoRawById(btn.dataset.pdfProg);
      try { downloadProgramacaoPdf(prog); toast('PDF gerado.', 'success'); }
      catch (err) { toast(err.message || 'Erro ao gerar PDF.', 'error'); }
    });
  });
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
