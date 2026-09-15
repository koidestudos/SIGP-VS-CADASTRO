import { showModal } from './ui.js';
import { getCoordenacaoById, formatDate, getGerenciaByProgramacao, getMunicipiosLabel, getRegionaisLabel } from '../data/seed.js';
import { normalizeStatus, isDevolvidaGerencia } from '../utils/status.js';
import { getIncluidoPorLabel } from '../services/users-service.js';
import { historicoTipoLabel, historicoPerfilLabel } from '../utils/programacao-historico.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatQuando(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

function historicoHtml(p) {
  const items = Array.isArray(p?.historico) ? [...p.historico].reverse() : [];
  if (!items.length) {
    return '<p class="text-sm text-muted">Nenhum evento registrado ainda.</p>';
  }
  return `<ul class="historico-list">${items.map((h) => `
    <li>
      <strong>${esc(historicoTipoLabel(h.tipo))}</strong>
      <span>${esc(h.porNome) || '—'}${historicoPerfilLabel(h.perfil) ? ` · ${esc(historicoPerfilLabel(h.perfil))}` : ''} · ${formatQuando(h.em)}</span>
      ${h.statusAnterior || h.statusNovo ? `<small>${esc(h.statusAnterior || '—')} → ${esc(h.statusNovo || '—')}</small>` : ''}
      ${h.observacao ? `<p>${esc(h.observacao)}</p>` : ''}
    </li>
  `).join('')}</ul>`;
}

export function programacaoDetailHtml(p, { showAuthor = false, showHistory = false } = {}) {
  if (!p) return '<p class="text-muted">Programação não encontrada.</p>';
  const coord = getCoordenacaoById(p.coordenacaoId);
  const eq = (p.equipe || []).map((e) => `${e.nome} (${e.cargo})`).join(', ');
  const incluidoPor = getIncluidoPorLabel(p);
  const incluidoEmail = String(p.criadoPorEmail || '').trim();
  const gerencia = p.gerencia || getGerenciaByProgramacao(p);
  const authorHtml = showAuthor
    ? `<div class="detail-item"><label>Incluído por</label><span title="${esc(incluidoEmail)}">${esc(incluidoPor) || '—'}${incluidoEmail && incluidoPor !== incluidoEmail ? `<br><small class="text-muted">${esc(incluidoEmail)}</small>` : ''}</span></div>`
    : '';
  const devolucaoHtml = isDevolvidaGerencia(p.status) && p.justificativaDevolucao
    ? `<div class="alert alert-error mb-3"><strong>Devolvida para correção</strong><p class="mb-0 mt-1">${esc(p.justificativaDevolucao)}</p>
        <small>${esc(p.devolvidoPorNome) || 'Gerência'} · ${formatQuando(p.devolvidoEm)}</small></div>`
    : '';
  const aprovacaoHtml = p.aprovadoEm
    ? `<div class="detail-item"><label>Aprovado por</label><span>${esc(p.aprovadoPorNome) || '—'}<br><small class="text-muted">${formatQuando(p.aprovadoEm)}</small></span></div>`
    : '';
  return `${devolucaoHtml}<div class="detail-grid">
    <div class="detail-item"><label>Título</label><span>${p.titulo}</span></div>
    <div class="detail-item"><label>Gerência responsável</label><span>${esc(gerencia) || '—'}</span></div>
    <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
    ${authorHtml}
    ${aprovacaoHtml}
    <div class="detail-item"><label>Equipe</label><span>${eq || p.responsavel || '—'}</span></div>
    <div class="detail-item"><label>Tipo</label><span>${p.tipoAtividade || '—'}</span></div>
    <div class="detail-item"><label>Status</label><span>${normalizeStatus(p.status)}</span></div>
    <div class="detail-item"><label>Data inicial</label><span>${formatDate(p.dataInicial)}</span></div>
    <div class="detail-item"><label>Data final</label><span>${formatDate(p.dataFinal)}</span></div>
    <div class="detail-item"><label>Município(s)</label><span>${getMunicipiosLabel(p)}</span></div>
    <div class="detail-item"><label>Regional(is)</label><span>${getRegionaisLabel(p)}</span></div>
    <div class="detail-item"><label>Local</label><span>${p.localAtividade || '—'}</span></div>
    <div class="detail-item"><label>Transporte</label><span>${
      p.transporteTipo === 'microonibus' ? 'Sim (microônibus)'
        : (p.necessitaTransporte ? 'Sim' : 'Não')
    }</span></div>
    <div class="detail-item"><label>Alimentação</label><span>${p.necessitaAlimentacao ? 'Sim' : 'Não'}</span></div>
    <div class="detail-item full-width"><label>Objetivo</label><span>${p.objetivo || '—'}</span></div>
  </div>
  ${showHistory ? `<div class="historico-block mt-3"><h4>Histórico</h4>${historicoHtml(p)}</div>` : ''}`;
}

export function showProgramacaoDetail(p, { footer = '', showAuthor = false, showHistory = false } = {}) {
  return showModal({
    title: p?.titulo || 'Programação',
    body: programacaoDetailHtml(p, { showAuthor, showHistory }),
    footer: footer || '<button class="btn btn-primary" data-modal-action="close">Fechar</button>',
    size: 'modal-lg',
  });
}
