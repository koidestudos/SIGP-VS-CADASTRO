import { showModal } from './ui.js';
import { getCoordenacaoById, formatDate, getGerenciaByProgramacao, getMunicipiosLabel, getRegionaisLabel } from '../data/seed.js';
import { normalizeStatus } from '../utils/status.js';
import { getIncluidoPorLabel } from '../services/users-service.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function programacaoDetailHtml(p, { showAuthor = false } = {}) {
  if (!p) return '<p class="text-muted">Programação não encontrada.</p>';
  const coord = getCoordenacaoById(p.coordenacaoId);
  const eq = (p.equipe || []).map((e) => `${e.nome} (${e.cargo})`).join(', ');
  const incluidoPor = getIncluidoPorLabel(p);
  const incluidoEmail = String(p.criadoPorEmail || '').trim();
  const authorHtml = showAuthor
    ? `<div class="detail-item"><label>Incluído por</label><span title="${esc(incluidoEmail)}">${esc(incluidoPor) || '—'}${incluidoEmail && incluidoPor !== incluidoEmail ? `<br><small class="text-muted">${esc(incluidoEmail)}</small>` : ''}</span></div>`
    : '';
  return `<div class="detail-grid">
    <div class="detail-item"><label>Título</label><span>${p.titulo}</span></div>
    <div class="detail-item"><label>Gerência</label><span>${getGerenciaByProgramacao(p)}</span></div>
    <div class="detail-item"><label>Coordenação</label><span>${coord?.nome || '—'}</span></div>
    ${authorHtml}
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
  </div>`;
}

export function showProgramacaoDetail(p, { footer = '', showAuthor = false } = {}) {
  return showModal({
    title: p?.titulo || 'Programação',
    body: programacaoDetailHtml(p, { showAuthor }),
    footer: footer || '<button class="btn btn-primary" data-modal-action="close">Fechar</button>',
    size: 'modal-lg',
  });
}
