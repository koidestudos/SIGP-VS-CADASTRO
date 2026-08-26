import { getCollection, updateLogisticaSituacao } from '../services/storage.js';
import { getProgramacaoRawById, getProgramacoes } from '../services/programacoes-service.js';
import { getMunicipioById, getStatusBadgeClass, formatDate, getGerenciaByProgramacao, getMunicipiosLabel } from '../data/seed.js';
import { STATUS_PROGRAMACAO } from '../utils/status.js';
import { toast } from '../components/ui.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';
import { downloadProgramacaoPdf } from '../utils/programacao-report-pdf.js';
import { isAdmin } from '../services/roles.js';
import {
  filterProgramacoes, readFilterState, getFilterDescription,
  renderProgramacoesFilterBar, bindProgramacoesFilterBar,
} from '../utils/programacoes-filters.js';

function getFilteredLogistica() {
  const logistica = getCollection('logistica');
  const filteredIds = new Set(filterProgramacoes(getProgramacoes(), readFilterState()).map((p) => p.id));
  return logistica.filter((l) => filteredIds.has(l.programacaoId));
}

function renderRows(items) {
  if (!items.length) {
    return '<tr><td colspan="7" class="text-center text-muted">Nenhuma solicitação para o filtro selecionado.</td></tr>';
  }
  return items.map((l) => {
    const prog = getProgramacaoRawById(l.programacaoId);
    return `
      <tr data-id="${l.id}">
        <td class="td-action">${prog?.titulo || '—'}
          ${prog ? `<br><span class="text-sm text-muted">${formatDate(prog.dataInicial)} — ${formatDate(prog.dataFinal)}</span>` : ''}</td>
        <td>${prog ? `<span class="gerencia-tag gerencia-${getGerenciaByProgramacao(prog).toLowerCase()}">${getGerenciaByProgramacao(prog)}</span>` : '—'}</td>
        <td>${getMunicipiosLabel(prog) !== '—' ? getMunicipiosLabel(prog) : (getMunicipioById(l.municipioId)?.nome || '—')}</td>
        <td>${(() => {
          if (!prog) return l.transporte ? '✔ Sim' : '✖ Não';
          if (prog.transporteTipo === 'microonibus') return '✔ Sim (microônibus)';
          return prog.necessitaTransporte || l.transporte ? '✔ Sim' : '✖ Não';
        })()}</td>
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
  }).join('');
}

export function renderLogistica() {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const items = getFilteredLogistica();

  return `
    <div class="page-header"><h2>Logística</h2></div>
    <p class="text-muted mb-3">Solicitações de transporte e alimentação vinculadas às programações.</p>
    ${renderProgramacoesFilterBar({
      mesAtual,
      statusOptions: STATUS_PROGRAMACAO,
      resumoId: 'filtro-log-resumo',
      resumoText: `Exibindo ${items.length} solicitação(ões)`,
    })}
    <div class="card">
      <div class="card-body">
        <div class="table-wrapper">
          <table id="tabela-logistica">
            <thead>
              <tr><th>Programação</th><th>Gerência</th><th>Município</th><th>Transporte</th><th>Alimentação</th><th>Situação</th><th>Ações</th></tr>
            </thead>
            <tbody>${renderRows(items)}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function bindRowActions(user) {
  document.querySelectorAll('[data-view-prog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prog = getProgramacaoRawById(btn.dataset.viewProg);
      showProgramacaoDetail(prog, { showAuthor: isAdmin(user) });
    });
  });
  document.querySelectorAll('[data-pdf-prog]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const prog = getProgramacaoRawById(btn.dataset.pdfProg);
      btn.disabled = true;
      try {
        await downloadProgramacaoPdf(prog);
        toast('PDF gerado.', 'success');
      } catch (err) {
        toast(err.message || 'Erro ao gerar PDF.', 'error');
      } finally {
        btn.disabled = false;
      }
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

export function bindLogistica(user) {
  const refresh = () => {
    const items = getFilteredLogistica();
    const tbody = document.querySelector('#tabela-logistica tbody');
    if (tbody) tbody.innerHTML = renderRows(items);
    const resumo = document.getElementById('filtro-log-resumo');
    if (resumo) {
      resumo.textContent = `${getFilterDescription()} — ${items.length} solicitação(ões)`;
    }
    bindRowActions(user);
  };

  bindProgramacoesFilterBar(refresh);
  bindRowActions(user);
  refresh();
}
