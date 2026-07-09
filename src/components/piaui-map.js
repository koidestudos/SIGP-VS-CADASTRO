/** Mapa do Piauí — imagem personalizável com marcadores */
import { getMunicipioById } from '../data/seed.js';
import { getProgramacoes } from '../services/programacoes-service.js';
import { assetImgHtml, CUSTOM_ASSET_PATHS } from '../config/custom-assets.js';

const CITY_COORDS = {
  'm-teresina': { x: 54.6, y: 28.9, nome: 'Teresina' },
  'm-parnaiba': { x: 73.6, y: 1.9, nome: 'Parnaíba' },
  'm-picos': { x: 79.3, y: 53.4, nome: 'Picos' },
  'm-floriano': { x: 50.6, y: 49.6, nome: 'Floriano' },
  'm-sao-raimundo-nonato': { x: 56.5, y: 76.7, nome: 'São Raimundo Nonato' },
  'm-pedro-ii': { x: 79.5, y: 20.7, nome: 'Pedro II' },
  'm-piripiri': { x: 73.6, y: 18.8, nome: 'Piripiri' },
  'm-campo-maior': { x: 66.3, y: 25.7, nome: 'Campo Maior' },
  'm-oeiras': { x: 67.0, y: 52.8, nome: 'Oeiras' },
  'm-bom-jesus': { x: 25.8, y: 78.0, nome: 'Bom Jesus' },
};

function defaultCoords(index) {
  const positions = [
    { x: 45, y: 30 }, { x: 60, y: 40 }, { x: 35, y: 50 },
    { x: 55, y: 65 }, { x: 40, y: 75 }, { x: 65, y: 25 },
  ];
  return positions[index % positions.length];
}

const STATUS_COLORS = {
  Programada: '#1351B4', Autorizado: '#168821', Aprovado: '#168821', Pendente: '#ca8a04', Rascunho: '#6C757D',
};

function mapBaseHtml(id) {
  return `
    <div class="piaui-map-container" id="${id}">
      ${assetImgHtml(CUSTOM_ASSET_PATHS.mapaPiaui, { alt: 'Mapa do Piauí', className: 'piaui-map-img' })}
      <div class="piaui-pins-layer"></div>
    </div>`;
}

export function renderPiauiHeatMap() {
  const programacoes = getProgramacoes();
  const byMunicipio = {};
  programacoes.forEach((p) => {
    if (!p.municipioId) return;
    byMunicipio[p.municipioId] = (byMunicipio[p.municipioId] || 0) + 1;
  });
  const max = Math.max(...Object.values(byMunicipio), 1);

  const pins = Object.entries(byMunicipio).map(([munId, count], i) => {
    const mun = getMunicipioById(munId);
    const coords = CITY_COORDS[munId] || { ...defaultCoords(i), nome: mun?.nome || 'Município' };
    const intensity = Math.ceil((count / max) * 4) || 1;
    return `
      <button type="button" class="piaui-pin piaui-heat-${intensity}" style="left:${coords.x}%;top:${coords.y}%"
        data-mun-id="${munId}" data-mun-name="${coords.nome}" data-count="${count}" title="${coords.nome}: ${count} programação(ões)">
        <span class="pin-count">${count}</span>
      </button>`;
  }).join('');

  return mapBaseHtml('piaui-heat-map').replace('</div></div>', `${pins}</div></div>`);
}

export function bindPiauiHeatMap(onSelect) {
  document.querySelectorAll('#piaui-heat-map .piaui-pin').forEach((pin) => {
    pin.addEventListener('click', () => onSelect?.(pin.dataset.munId, pin.dataset.munName));
  });
}

export function renderPiauiMap() {
  const programacoes = getProgramacoes();
  const byMunicipio = {};
  programacoes.forEach((p) => {
    if (!p.municipioId) return;
    if (!byMunicipio[p.municipioId]) byMunicipio[p.municipioId] = [];
    byMunicipio[p.municipioId].push(p);
  });

  const pins = Object.entries(byMunicipio).map(([munId, progs], i) => {
    const mun = getMunicipioById(munId);
    const coords = CITY_COORDS[munId] || { ...defaultCoords(i), nome: mun?.nome || 'Município' };
    const color = STATUS_COLORS[progs[0].status] || '#1351B4';
    return `
      <button type="button" class="piaui-pin" style="left:${coords.x}%;top:${coords.y}%;background:${color}"
        data-mun-id="${munId}" data-mun-name="${coords.nome}" data-count="${progs.length}" title="${coords.nome}: ${progs.length} ação(ões)">
      </button>`;
  }).join('');

  return `
    <div class="piaui-map-container" id="piaui-map">
      ${assetImgHtml(CUSTOM_ASSET_PATHS.mapaPiaui, { alt: 'Mapa do Piauí', className: 'piaui-map-img' })}
      <div class="piaui-pins-layer">${pins}</div>
      <div class="piaui-tooltip hidden" id="piaui-tooltip"></div>
    </div>`;
}

export function bindPiauiMap() {
  const tooltip = document.getElementById('piaui-tooltip');
  document.querySelectorAll('.piaui-pin').forEach((pin) => {
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
