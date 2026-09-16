import { getProgramacoes, removeProgramacao, getProgramacaoById, updateProgramacaoStatus, approveProgramacaoByGerencia, devolverProgramacaoParaCorrecao, formatProgramacaoError } from '../services/programacoes-service.js';
import {
  canUploadAnexo, uploadProgramacaoAnexo, formatUploadError,
  getAnexosByProgramacao, canDeleteAnexo, deleteAnexo, openAnexo,
} from '../services/anexos-service.js';
import {
  canApproveGerencia, canDeleteProgramacao, canEditProgramacao, isAdmin, getUserRole,
  canSeeAuthor, canCreateProgramacao, canChangeProgramacaoStatus, canSeeHistory,
  filterProgramacoesByAccess, programacaoActionFlags, MSG_EDICAO_NEGADA, MSG_PRIORIZADA_SEMANA,
  statusChangeConfirmMessage,
} from '../services/roles.js';
import { getIncluidoPorLabel } from '../services/users-service.js';
import {
  getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass,
  getGerenciaByProgramacao, getMunicipiosLabel,
} from '../data/seed.js';
import { normalizeStatus, getStatusOptionsForUser, needsGerenciaApproval, STATUS_PROGRAMACAO, canAttachAnexo, getStatusRowClass, statusRequiresJustificativa, STATUS_APROVADA_GERENCIA } from '../utils/status.js';
import { showModal, confirmDialog, toast, renderActionButtons } from '../components/ui.js';
import { showProgramacaoDetail } from '../components/programacao-detail.js';
import { downloadProgramacaoPdf } from '../utils/programacao-report-pdf.js';
import { downloadProgramacoesListXlsx } from '../utils/programacoes-report-xlsx.js';
import {
  renderModeloAnexoFormHtml,
  collectModeloAnexoForm,
  validateModeloAnexoForm,
  downloadModeloAnexoPdf,
} from '../utils/modelo-anexo-pdf.js';
import {
  filterProgramacoes, readFilterState, getFilterDescription,
  renderProgramacoesFilterBar, bindProgramacoesFilterBar, persistCurrentFilters,
} from '../utils/programacoes-filters.js';
import { findPriorizadaConflito } from '../utils/programacao-prioridade.js';

function scopedProgramacoes(user) {
  return filterProgramacoesByAccess(getProgramacoes(), user);
}

const FILTER_KEY = 'programacoes';

export function renderProgramacoes(user) {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const showAuthor = canSeeAuthor(user);
  const filterState = readFilterState(FILTER_KEY);
  const items = filterProgramacoes(scopedProgramacoes(user), filterState);

  return `
    <div class="page-header">
      <h2>Programações</h2>
      <div class="page-header-actions">
        <button type="button" class="btn btn-outline" id="btn-modelo-anexo">Fazer modelo de anexo</button>
        ${canCreateProgramacao(user) ? '<button class="btn btn-primary" id="btn-nova">+ Nova Programação</button>' : ''}
      </div>
    </div>
    ${renderProgramacoesFilterBar({
      mesAtual,
      showPdfButton: true,
      statusOptions: STATUS_PROGRAMACAO,
      storageKey: FILTER_KEY,
      resumoText: `${getFilterDescription(filterState)} — ${items.length} programação(ões)`,
    })}
    <div class="card prog-list-card"><div class="card-body"><div class="table-wrapper prog-table-wrap">
      <table id="tabela-programacoes" class="prog-table${showAuthor ? ' prog-table-admin' : ''}"><thead><tr>
        <th class="col-acao">Ação</th>
        <th class="col-ger">Gerência</th>
        <th class="col-coord">Coordenação</th>
        <th class="col-mun">Município</th>
        <th class="col-date">Data inicial</th>
        <th class="col-date">Data final</th>
        <th class="col-equipe">Equipe</th>
        ${showAuthor ? '<th class="col-incluido">Incluído por</th>' : ''}
        <th class="col-status">Status</th>
        <th class="col-acoes">Ações</th>
      </tr></thead><tbody>${renderRows(items, user)}</tbody></table>
    </div></div></div>`;
}

function equipeLabel(p) {
  const eq = (p.equipe || []).map((e) => e.nome).filter(Boolean);
  if (eq.length) return eq.slice(0, 2).join(', ') + (eq.length > 2 ? '…' : '');
  return p.responsavel || '—';
}

function renderRows(items, user) {
  const showAuthor = canSeeAuthor(user);
  const colCount = showAuthor ? 10 : 9;
  if (!items.length) return `<tr><td colspan="${colCount}" class="text-center text-muted">Nenhuma programação.</td></tr>`;
  return items.map((p) => {
    const coord = getCoordenacaoById(p.coordenacaoId);
    const munLabel = getMunicipiosLabel(p);
    const ger = getGerenciaByProgramacao(p);
    const flags = programacaoActionFlags(user, p);
    const canEdit = flags.edit;
    const pendingGerencia = needsGerenciaApproval(p.status);
    const approve = (flags.approve && (isAdmin(user) || pendingGerencia))
      ? `<button class="btn-icon" data-action="approve" data-id="${p.id}" title="${pendingGerencia ? 'Aprovar / analisar' : 'Analisar programação'}">✔</button>`
      : '';
    const reject = (flags.reject && pendingGerencia)
      ? `<button class="btn-icon" data-action="reprovar" data-id="${p.id}" title="Reprovar / devolver">✖</button>`
      : '';
    const statusOptions = getStatusOptionsForUser(user, p);
    const adminUser = isAdmin(user) || getUserRole() === 'admin';
    const canChangeStatus = Boolean(flags.changeStatus || adminUser) && (adminUser || statusOptions.length > 1);
    const statusCell = canChangeStatus
      ? `<select class="form-control status-select" data-status-id="${p.id}" title="Alterar status">
          ${(adminUser ? STATUS_PROGRAMACAO : statusOptions).map((s) => `<option value="${s}" ${normalizeStatus(p.status) === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>`
      : `<span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span>`;
    const canAttach = canAttachAnexo(p.status);
    const temAnexo = getAnexosByProgramacao(p.id).length > 0;
    const titulo = String(p.titulo || '—');
    const coordNome = coord?.nome || '—';
    const coordSigla = coord?.sigla || '';
    const coordLabel = coordSigla
      ? `<strong class="coord-sigla">${coordSigla}</strong><span class="coord-nome">${coordNome}</span>`
      : `<span class="coord-nome">${coordNome}</span>`;
    const incluidoPor = getIncluidoPorLabel(p) || '—';
    const incluidoTitle = [incluidoPor, p.criadoPorEmail].filter(Boolean).join(' · ').replace(/"/g, '&quot;');
    return `<tr class="${getStatusRowClass(p.status)}">
      <td class="col-acao"><span class="prog-acao" title="${titulo.replace(/"/g, '&quot;')}">${titulo}</span></td>
      <td class="col-ger"><span class="gerencia-tag gerencia-${ger.toLowerCase()}">${ger}</span></td>
      <td class="col-coord" title="${coordNome.replace(/"/g, '&quot;')}">${coordLabel}</td>
      <td class="col-mun"><span class="cell-clip" title="${String(munLabel).replace(/"/g, '&quot;')}">${munLabel}</span></td>
      <td class="col-date">${formatDate(p.dataInicial)}</td>
      <td class="col-date">${formatDate(p.dataFinal)}</td>
      <td class="col-equipe"><span class="cell-clip" title="${equipeLabel(p).replace(/"/g, '&quot;')}">${equipeLabel(p)}</span></td>
      ${showAuthor ? `<td class="col-incluido"><span class="cell-clip" title="${incluidoTitle}">${incluidoPor.replace(/</g, '&lt;')}</span></td>` : ''}
      <td class="col-status">${statusCell}</td>
      <td class="col-acoes">${renderActionButtons(p.id, {
        edit: canEdit,
        del: canDeleteProgramacao(user, p),
        extra: `<button class="btn-icon" data-action="pdf" data-id="${p.id}" title="Baixar PDF">📄</button>`
          + ((canAttach || temAnexo)
            ? `<button class="btn-icon" data-action="anexo" data-id="${p.id}" title="Anexos">📎</button>`
            : `<button class="btn-icon" disabled title="Anexo indisponível (reprovada/cancelada)">📎</button>`)
          + approve + reject
          + (flags.changeStatus ? `<button class="btn-icon" data-action="status" data-id="${p.id}" title="Alterar status">⟳</button>` : '')
          + (canEdit ? `<button class="btn-icon" data-action="duplicate" data-id="${p.id}" title="Duplicar">📋</button>` : ''),
      })}</td>
    </tr>`;
  }).join('');
}

function renderAnexosListHtml(prog, user) {
  const anexos = getAnexosByProgramacao(prog.id);
  if (!anexos.length) {
    return '<p class="text-sm text-muted mb-3">Nenhum anexo enviado nesta programação.</p>';
  }
  const rows = anexos.map((a) => {
    const quando = a.enviadoEm ? new Date(a.enviadoEm).toLocaleString('pt-BR') : '—';
    const canDel = canDeleteAnexo(a, user);
    const nome = String(a.nomeArquivo || 'Arquivo').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return `<li class="anexo-manage-item">
      <div class="anexo-manage-info">
        <strong title="${nome}">${nome}</strong>
        <span>${String(a.enviadoPorNome || '—').replace(/</g, '&lt;')} · ${quando}</span>
      </div>
      <div class="table-actions">
        <button type="button" class="btn btn-outline btn-sm" data-modal-action="open-anexo" data-anexo-id="${a.id}">Abrir</button>
        ${canDel ? `<button type="button" class="btn btn-outline-danger btn-sm" data-modal-action="del-anexo" data-anexo-id="${a.id}">Excluir</button>` : ''}
      </div>
    </li>`;
  }).join('');
  return `
    <div class="anexo-manage-block mb-3">
      <h4 class="text-sm" style="margin:0 0 8px;font-weight:700;color:var(--primary-dark)">Anexos enviados</h4>
      <p class="text-sm text-muted mb-2">Enviou errado? Exclua o seu anexo e envie novamente.</p>
      <ul class="anexo-manage-list">${rows}</ul>
    </div>`;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function userIsAdmin(user) {
  return isAdmin(user) || getUserRole() === 'admin';
}

function canChangeStatusNow(user, prog) {
  return userIsAdmin(user) || canChangeProgramacaoStatus(user, prog);
}

async function promptStatusChange(prog, nextStatus, user) {
  const prev = normalizeStatus(prog.status);
  const next = normalizeStatus(nextStatus);
  if (!next || prev === next) return null;
  if (!canChangeStatusNow(user, prog)) {
    toast('Você não possui permissão para alterar o status desta programação.', 'error');
    return null;
  }
  const admin = userIsAdmin(user);
  const needsObs = statusRequiresJustificativa(next);
  const conflito = next === 'Priorizada'
    ? findPriorizadaConflito(getProgramacoes(), {
      gerencia: prog.gerenciaId || prog.gerencia,
      dataInicial: prog.dataInicial,
      excludeId: prog.id,
    })
    : null;
  if (conflito && !admin) {
    toast(MSG_PRIORIZADA_SEMANA, 'error');
    return null;
  }

  let observacao = '';
  let forcePriorizada = false;
  const result = await showModal({
    title: 'Alterar status',
    body: `
      <p>${escHtml(statusChangeConfirmMessage(prev, next))}</p>
      ${admin ? '<p class="text-sm text-muted">Como administrador, você pode alterar qualquer status.</p>' : ''}
      ${needsObs ? `<div class="form-group mt-2"><label>Justificativa *</label>
        <textarea class="form-control" id="status-obs" rows="3" maxlength="2000"></textarea></div>` : ''}
      ${conflito && admin ? `<div class="alert alert-warning mt-2">${escHtml(MSG_PRIORIZADA_SEMANA)}</div>
        <p class="text-sm text-muted">Administrador: a priorização será aplicada mesmo com conflito.</p>` : ''}
    `,
    footer: `<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
      <button class="btn btn-primary" data-modal-action="confirm">Confirmar</button>`,
    onAction: (act, overlay) => {
      if (act !== 'confirm') return;
      observacao = overlay.querySelector('#status-obs')?.value.trim() || '';
      if (needsObs && !observacao) {
        toast('Informe a justificativa ou observação para este status.', 'error');
        return false;
      }
      if (conflito && admin) {
        forcePriorizada = true;
      }
    },
  });
  if (result !== 'confirm') return null;
  return { observacao, forcePriorizada, next };
}

async function applyStatusChange(prog, nextStatus, user) {
  const decision = await promptStatusChange(prog, nextStatus, user);
  if (!decision) return false;
  try {
    await updateProgramacaoStatus(prog.id, decision.next, {
      observacao: decision.observacao,
      ...(statusRequiresJustificativa(decision.next) && decision.observacao
        ? { justificativaDevolucao: decision.observacao }
        : {}),
      forcePriorizada: decision.forcePriorizada,
    });
    toast('Status atualizado.', 'success');
    return true;
  } catch (err) {
    toast(formatProgramacaoError(err, 'Erro ao atualizar status.'), 'error');
    return false;
  }
}

async function showStatusPicker(prog, user) {
  if (!canChangeStatusNow(user, prog)) {
    toast('Você não possui permissão para alterar o status desta programação.', 'error');
    return false;
  }
  const options = userIsAdmin(user) ? STATUS_PROGRAMACAO : getStatusOptionsForUser(user, prog);
  const current = normalizeStatus(prog.status);
  let selected = current;
  const result = await showModal({
    title: 'Alterar status',
    body: `<p class="text-sm text-muted mb-2">${userIsAdmin(user)
      ? 'Administrador: você pode alterar o status livremente em qualquer programação.'
      : 'Somente o status será alterado. O conteúdo cadastrado permanece bloqueado para quem não é o autor.'}</p>
      <div class="form-group"><label>Novo status</label>
      <select class="form-control" id="status-pick">
        ${options.map((s) => `<option value="${escHtml(s)}" ${s === current ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
      </select></div>`,
    footer: `<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
      <button class="btn btn-primary" data-modal-action="confirm">Continuar</button>`,
    onAction: (act, overlay) => {
      if (act !== 'confirm') return;
      selected = overlay.querySelector('#status-pick')?.value || current;
    },
  });
  if (result !== 'confirm') return false;
  return applyStatusChange(prog, selected, user);
}

async function showAnexoDialog(prog, user) {
  let reopen = true;
  while (reopen) {
    reopen = false;
    const existentes = getAnexosByProgramacao(prog.id);
    const canUpload = canUploadAnexo(prog, user);
    if (!canUpload && !existentes.length && isAdmin(user)) {
      toast('Não é possível anexar documentos em programações reprovadas ou canceladas.', 'error');
      return;
    }

    const uploadBlock = canUpload ? `
      <div class="form-group">
        <label>Novo documento (PDF, imagem ou Office — máx. 10 MB)</label>
        <input type="file" class="form-control" id="anexo-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" />
      </div>
      <p class="text-sm text-muted mb-0 mt-2">Ao enviar, a programação será marcada como <strong>Realizada</strong>.</p>
      <p class="text-sm text-muted" id="anexo-status" style="display:none;margin-top:8px">Enviando arquivo...</p>`
      : `<p class="text-sm text-muted">${isAdmin(user) ? 'Envio bloqueado para programações reprovadas ou canceladas.' : 'Consulta apenas — somente o autor do cadastro ou o administrador envia anexos.'}</p>`;

    const result = await showModal({
      title: 'Anexos da programação',
      size: 'modal-lg',
      body: `
        <p class="text-sm text-muted mb-2">Programação: <strong>${String(prog.titulo || '—').replace(/</g, '&lt;')}</strong></p>
        ${renderAnexosListHtml(prog, user)}
        ${uploadBlock}`,
      footer: `
        <button class="btn btn-ghost" data-modal-action="cancel">Fechar</button>
        ${canUpload ? '<button class="btn btn-primary" data-modal-action="enviar">Enviar anexo</button>' : ''}`,
      onAction: async (act, overlay, btn) => {
        if (act === 'open-anexo') {
          const found = getAnexosByProgramacao(prog.id).find((a) => a.id === btn?.dataset?.anexoId);
          if (!found) { toast('Anexo não encontrado.', 'error'); return false; }
          try {
            btn.disabled = true;
            await openAnexo(found);
          } catch (err) {
            toast(err.message || 'Erro ao abrir anexo.', 'error');
          } finally {
            btn.disabled = false;
          }
          return false;
        }
        if (act === 'del-anexo') {
          const found = getAnexosByProgramacao(prog.id).find((a) => a.id === btn?.dataset?.anexoId);
          if (!found) { toast('Anexo não encontrado.', 'error'); return false; }
          if (!canDeleteAnexo(found, user)) {
            toast('Somente a administradora pode excluir anexos.', 'error');
            return false;
          }
          if ((await confirmDialog(`Excluir o anexo "${found.nomeArquivo || 'arquivo'}"?`)) !== 'confirm') return false;
          try {
            btn.disabled = true;
            await deleteAnexo(found.id);
            toast('Anexo excluído.', 'success');
            return; // fecha e reabre
          } catch (err) {
            toast(err.message || 'Erro ao excluir anexo.', 'error');
            btn.disabled = false;
            return false;
          }
        }
        if (act !== 'enviar') return;
        if (!canUpload) return false;
        const file = overlay.querySelector('#anexo-file')?.files?.[0] || null;
        if (!file) {
          toast('Selecione um arquivo.', 'error');
          return false;
        }
        const sendBtn = overlay.querySelector('[data-modal-action="enviar"]');
        const statusEl = overlay.querySelector('#anexo-status');
        if (sendBtn) {
          sendBtn.disabled = true;
          sendBtn.textContent = 'Enviando...';
        }
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.textContent = 'Preparando envio...';
        }
        try {
          await uploadProgramacaoAnexo(prog.id, file, {
            onProgress: (pct, label) => {
              if (statusEl) statusEl.textContent = label || `Enviando... ${pct}%`;
              if (sendBtn) sendBtn.textContent = pct >= 100 ? 'Concluído' : `Enviando ${pct}%`;
            },
          });
          toast('Anexo enviado! Programação marcada como Realizada.', 'success');
          return;
        } catch (err) {
          console.error(err);
          const msg = formatUploadError(err);
          toast(msg, 'error');
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.textContent = msg;
            statusEl.style.color = '#b42318';
          }
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Enviar anexo';
          }
          return false;
        }
      },
    });
    if (result === 'del-anexo') reopen = true;
  }
}

async function showModeloAnexoDialog(user) {
  await showModal({
    title: 'Relatório Simplificado de Execução da Ação',
    size: 'modal-lg',
    body: renderModeloAnexoFormHtml({
      responsavelNome: user?.nome || '',
      responsavelCargo: user?.cargo || '',
    }),
    footer: `
      <button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
      <button class="btn btn-primary" data-modal-action="exportar">Exportar PDF</button>`,
    onAction: async (act, overlay) => {
      if (act !== 'exportar') return;
      const data = collectModeloAnexoForm(overlay);
      const err = validateModeloAnexoForm(data);
      if (err) {
        toast(err, 'error');
        return false;
      }
      try {
        downloadModeloAnexoPdf(data);
        toast('PDF do relatório gerado com sucesso.', 'success');
      } catch (e) {
        console.error(e);
        toast(e.message || 'Erro ao gerar PDF.', 'error');
        return false;
      }
    },
  });
}

async function showApproveDialog(id, user) {
  const prog = getProgramacaoById(id);
  if (!prog) { toast('Programação não encontrada.', 'error'); return; }
  const pending = needsGerenciaApproval(prog.status);
  const canAct = canApproveGerencia(user, prog) && (pending || isAdmin(user));
  // Se não está pendente e é admin, abre o seletor de status (permissão total)
  if (isAdmin(user) && !pending) {
    await showStatusPicker(prog, user);
    return;
  }
  const action = await showProgramacaoDetail(prog, {
    showAuthor: canSeeAuthor(user),
    showHistory: canSeeHistory(user, prog),
    footer: canAct
      ? `<button class="btn btn-ghost" data-modal-action="cancel">Fechar</button>
         <button class="btn btn-outline" data-modal-action="devolver">Devolver para correção</button>
         <button class="btn btn-primary" data-modal-action="aprovar">Aprovar</button>`
      : `<button class="btn btn-primary" data-modal-action="close">Fechar</button>`,
  });
  if (action === 'aprovar') {
    if ((await confirmDialog('Aprovar esta programação pela Gerência?')) !== 'confirm') return;
    try {
      await approveProgramacaoByGerencia(id);
      toast('Programação aprovada pela Gerência.', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao aprovar.', 'error');
    }
    return;
  }
  if (action === 'devolver') {
    let justificativa = '';
    const result = await showModal({
      title: 'Devolver para correção',
      body: `<p class="text-sm mb-2">Informe a justificativa. A Coordenação verá esta observação e poderá corrigir e reenviar.</p>
        <div class="form-group"><label>Justificativa *</label>
        <textarea class="form-control" id="ger-justificativa" rows="4" maxlength="2000"></textarea></div>`,
      footer: `<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
        <button class="btn btn-primary" data-modal-action="confirm">Devolver</button>`,
      onAction: (act, overlay) => {
        if (act !== 'confirm') return;
        justificativa = overlay.querySelector('#ger-justificativa')?.value.trim() || '';
        if (!justificativa) {
          toast('Informe a justificativa da devolução.', 'error');
          return false;
        }
      },
    });
    if (result !== 'confirm' || !justificativa) return;
    try {
      await devolverProgramacaoParaCorrecao(id, justificativa);
      toast('Programação devolvida para a Coordenação.', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao devolver.', 'error');
    }
  }
}

export function bindProgramacoes(user) {
  const table = document.getElementById('tabela-programacoes');
  if (table?.dataset.bound === '1') return;
  if (table) table.dataset.bound = '1';

  const refresh = () => {
    const state = readFilterState(FILTER_KEY);
    const items = filterProgramacoes(scopedProgramacoes(user), state);
    const tbody = document.querySelector('#tabela-programacoes tbody');
    if (tbody) tbody.innerHTML = renderRows(items, user);
    const resumo = document.getElementById('filtro-resumo');
    if (resumo) {
      resumo.textContent = `${getFilterDescription(state)} — ${items.length} programação(ões)`;
    }
  };

  bindProgramacoesFilterBar(refresh, FILTER_KEY);

  document.getElementById('btn-download-filtro')?.addEventListener('click', async () => {
    const state = readFilterState(FILTER_KEY);
    const items = filterProgramacoes(scopedProgramacoes(user), state);
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
    const btn = document.getElementById('btn-download-filtro');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Gerando Excel...';
    }
    try {
      await downloadProgramacoesListXlsx(items, {
        title: getFilterDescription(state),
        subtitle: [state.gerencia, state.status].filter(Boolean).join(' · ') || undefined,
      });
      toast(`Excel com ${items.length} programação(ões) gerado.`, 'success');
    } catch (err) {
      toast(err.message || 'Erro ao gerar Excel.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⬇ Baixar Excel do filtro';
      }
    }
  });

  document.getElementById('btn-nova')?.addEventListener('click', () => {
    persistCurrentFilters(FILTER_KEY);
    window.location.hash = 'nova-programacao';
  });
  document.getElementById('btn-modelo-anexo')?.addEventListener('click', () => { showModeloAnexoDialog(user); });
  document.getElementById('tabela-programacoes')?.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status-id]');
    if (!sel) return;
    const prog = getProgramacaoById(sel.dataset.statusId);
    const previous = normalizeStatus(prog?.status);
    const changed = await applyStatusChange(prog, sel.value, user);
    if (!changed) sel.value = previous;
    else refresh();
  });
  document.getElementById('tabela-programacoes')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, action } = btn.dataset;
    const prog = getProgramacaoById(id);
    if (action === 'view') {
      showProgramacaoDetail(prog, { showAuthor: canSeeAuthor(user), showHistory: canSeeHistory(user, prog) });
    }
    if (action === 'pdf') {
      btn.disabled = true;
      try {
        await downloadProgramacaoPdf(prog);
        toast('PDF gerado.', 'success');
      } catch (err) {
        toast(err.message || 'Erro ao gerar PDF.', 'error');
      } finally {
        btn.disabled = false;
      }
    }
    if (action === 'edit') {
      if (!canEditProgramacao(user, prog)) { toast(MSG_EDICAO_NEGADA, 'error'); return; }
      persistCurrentFilters(FILTER_KEY);
      window.location.hash = `nova-programacao/edit/${id}`;
    }
    if (action === 'status') {
      await showStatusPicker(prog, user);
      refresh();
    }
    if (action === 'duplicate') {
      persistCurrentFilters(FILTER_KEY);
      window.location.hash = `nova-programacao/duplicate/${id}`;
    }
    if (action === 'delete') {
      if (!canDeleteProgramacao(user)) {
        toast('Somente o administrador pode excluir programações.', 'error');
        return;
      }
      if ((await confirmDialog('Excluir programação?')) === 'confirm') {
        await removeProgramacao(id); toast('Excluída.', 'success'); refresh();
      }
    }
    if (action === 'approve') {
      if (needsGerenciaApproval(prog?.status)) {
        await showApproveDialog(id, user);
      } else {
        await applyStatusChange(prog, STATUS_APROVADA_GERENCIA, user);
      }
      refresh();
    }
    if (action === 'reprovar') {
      await applyStatusChange(prog, 'Reprovada', user);
      refresh();
    }
    if (action === 'anexo' && prog) { await showAnexoDialog(prog, user); refresh(); }
  });
  refresh();
}
