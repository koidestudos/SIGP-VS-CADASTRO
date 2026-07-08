/** Mapa do Piauí com marcadores de programações */
import { getMunicipioById } from '../data/seed.js';
import { getProgramacoes } from '../services/programacoes-service.js';

// Posições aproximadas (x%, y%) no contorno do Piauí
const CITY_COORDS = {
  'm-teresina': { x: 52, y: 18, nome: 'Teresina' },
  'm-parnaiba': { x: 78, y: 8, nome: 'Parnaíba' },
  'm-picos': { x: 58, y: 48, nome: 'Picos' },
  'm-floriano': { x: 42, y: 62, nome: 'Floriano' },
  'm-sao-raimundo-nonato': { x: 28, y: 78, nome: 'São Raimundo Nonato' },
  'm-pedro-ii': { x: 48, y: 28, nome: 'Pedro II' },
  'm-piripiri': { x: 55, y: 22, nome: 'Piripiri' },
  'm-campo-maior': { x: 50, y: 24, nome: 'Campo Maior' },
  'm-oeiras': { x: 54, y: 55, nome: 'Oeiras' },
  'm-bom-jesus': { x: 35, y: 85, nome: 'Bom Jesus' },
  'm-parnaiba': { x: 78, y: 8, nome: 'Parnaíba' },
};

function defaultCoords(index) {
  const positions = [
    { x: 45, y: 30 }, { x: 60, y: 40 }, { x: 35, y: 50 },
    { x: 55, y: 65 }, { x: 40, y: 75 }, { x: 65, y: 25 },
  ];
  return positions[index % positions.length];
}

const STATUS_COLORS = { Publicada: '#168821', Pendente: '#ca8a04', Aprovada: '#168821', Rascunho: '#1351B4' };

export function renderPiauiMap(onCityClick) {
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
      </button>
    `;
  }).join('');

  return `
    <div class="piaui-map-container" id="piaui-map">
      <svg class="piaui-outline" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg" aria-label="Mapa do Piauí">
        <path fill="#c8e6c9" stroke="#81c784" stroke-width="1.5" d="
          M95,8 L130,12 L155,25 L168,45 L175,70 L180,95 L178,120 L172,145
          L165,170 L158,195 L145,215 L125,235 L100,250 L75,258 L55,252 L40,235
          L28,210 L22,185 L20,160 L22,135 L28,110 L35,85 L45,65 L55,45 L65,30 L80,18 Z
        "/>
        <path fill="#a5d6a7" stroke="none" opacity="0.5" d="
          M60,80 L90,75 L110,90 L105,120 L85,140 L60,130 Z
          M100,100 L140,95 L150,120 L135,150 L105,145 Z
        "/>
      </svg>
      <div class="piaui-pins-layer">${pins}</div>
      <div class="piaui-tooltip hidden" id="piaui-tooltip"></div>
    </div>
  `;
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
        <a href="#municipios/${pin.dataset.munId}">Ver detalhes</a>
      `;
    });
    pin.addEventListener('mouseleave', () => tooltip?.classList.add('hidden'));
    pin.addEventListener('click', () => {
      window.location.hash = `municipios/${pin.dataset.munId}`;
    });
  });
}
