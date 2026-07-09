/** Mapa do Piauí — imagem personalizável com marcadores por município */
import { getMunicipioById } from '../data/seed.js';
import { getProgramacoes } from '../services/programacoes-service.js';
import { assetImgHtml, CUSTOM_ASSET_PATHS } from '../config/custom-assets.js';
import { getMunicipioMapCoordsWithName } from '../data/piaui-municipio-coords.js';

import { getProgramacoesForBI } from '../utils/bi-metrics.js';
import { normalizeStatus } from '../utils/status.js';

const STATUS_COLORS = {
  Autorizada: '#1351B4',
  'Em execução': '#0d9488',
  Realizada: '#168821',
  'Em análise': '#ca8a04',
  'Enviada para Gerência': '#6366f1',
  Rascunho: '#6C757D',
  Programada: '#1351B4',
  Autorizado: '#168821',
  Aprovado: '#168821',
  Pendente: '#ca8a04',
};

function mapHtml(id, pinsHtml = '') {
  return `
    <div class="piaui-map-container" id="${id}">
      ${assetImgHtml(CUSTOM_ASSET_PATHS.mapaPiaui, { alt: 'Mapa do Piauí', className: 'piaui-map-img' })}
      <div class="piaui-pins-layer">${pinsHtml}</div>
    </div>`;
}

/**
 * Ajusta o aspect-ratio do container para o da imagem carregada,
 * garantindo que as posições % dos pins coincidam com a imagem.
 */
function fitMapAspect(containerId) {
  const container = document.getElementById(containerId);
  const img = container?.querySelector('.piaui-map-img');
  if (!container || !img) return;
  const apply = () => {
    if (img.naturalWidth && img.naturalHeight) {
      container.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    }
  };
  if (img.complete) apply();
  img.addEventListener('load', apply);
}

export function renderPiauiHeatMap() {
  const programacoes = getProgramacoesForBI(getProgramacoes());
  const byMunicipio = {};
  programacoes.forEach((p) => {
    if (!p.municipioId) return;
    byMunicipio[p.municipioId] = (byMunicipio[p.municipioId] || 0) + 1;
  });
  const max = Math.max(...Object.values(byMunicipio), 1);

  const pins = Object.entries(byMunicipio).map(([munId, count]) => {
    const mun = getMunicipioById(munId);
    const coords = getMunicipioMapCoordsWithName(munId, mun?.nome);
    const intensity = Math.ceil((count / max) * 4) || 1;
    return `
      <button type="button" class="piaui-pin piaui-heat-${intensity}" style="left:${coords.x}%;top:${coords.y}%"
        data-mun-id="${munId}" data-mun-name="${coords.nome}" data-count="${count}" title="${coords.nome}: ${count} programação(ões)">
        <span class="pin-count">${count}</span>
      </button>`;
  }).join('');

  return mapHtml('piaui-heat-map', pins);
}

export function bindPiauiHeatMap(onSelect) {
  fitMapAspect('piaui-heat-map');
  document.querySelectorAll('#piaui-heat-map .piaui-pin').forEach((pin) => {
    pin.addEventListener('click', () => onSelect?.(pin.dataset.munId, pin.dataset.munName));
  });
}

export function renderPiauiMap() {
  const programacoes = getProgramacoesForBI(getProgramacoes());
  const byMunicipio = {};
  programacoes.forEach((p) => {
    if (!p.municipioId) return;
    if (!byMunicipio[p.municipioId]) byMunicipio[p.municipioId] = [];
    byMunicipio[p.municipioId].push(p);
  });

  const pins = Object.entries(byMunicipio).map(([munId, progs]) => {
    const coords = getMunicipioMapCoordsWithName(munId);
    const color = STATUS_COLORS[normalizeStatus(progs[0].status)] || '#1351B4';
    return `
      <button type="button" class="piaui-pin" style="left:${coords.x}%;top:${coords.y}%;background:${color}"
        data-mun-id="${munId}" data-mun-name="${coords.nome}" data-count="${progs.length}" title="${coords.nome}: ${progs.length} ação(ões)">
      </button>`;
  }).join('');

  return `
    ${mapHtml('piaui-map', pins)}
    <div class="piaui-tooltip hidden" id="piaui-tooltip"></div>`;
}

export function bindPiauiMap() {
  fitMapAspect('piaui-map');
  const tooltip = document.getElementById('piaui-tooltip');
  document.querySelectorAll('#piaui-map .piaui-pin').forEach((pin) => {
    pin.addEventListener('mouseenter', () => {
      if (!tooltip) return;
      tooltip.classList.remove('hidden');
      tooltip.innerHTML = `
        <strong>${pin.dataset.munName}</strong>
        <span>${pin.dataset.count} ações previstas</span>
        <a href="#municipios/${pin.dataset.munId}">Ver detalhes</a>`;
    });
    pin.addEventListener('mouseleave', () => tooltip?.classList.add('hidden'));
    pin.addEventListener('click', () => { window.location.hash = `municipios/${pin.dataset.munId}`; });
  });
}
