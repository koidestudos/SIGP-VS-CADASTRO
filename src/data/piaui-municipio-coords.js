/**
 * Posições dos municípios sobre o mapa silhueta do Piauí.
 *
 * As posições são calculadas a partir de latitude/longitude reais,
 * projetadas linearmente sobre a área que a silhueta ocupa na imagem
 * (public/assets/custom/mapa-piaui.png).
 */
import { MUNICIPIOS } from './reference-data.js';

/** Limites geográficos do Piauí */
const GEO = { lonMin: -46.0, lonMax: -40.35, latN: -2.73, latS: -10.95 };

/** Área (em % da imagem) que a silhueta do estado ocupa */
const IMG_BOX = { xMin: 19.5, xMax: 80.5, yMin: 6, yMax: 92.5 };

function project(lat, lon) {
  const fx = (lon - GEO.lonMin) / (GEO.lonMax - GEO.lonMin);
  const fy = (GEO.latN - lat) / (GEO.latN - GEO.latS);
  return {
    x: IMG_BOX.xMin + fx * (IMG_BOX.xMax - IMG_BOX.xMin),
    y: IMG_BOX.yMin + fy * (IMG_BOX.yMax - IMG_BOX.yMin),
  };
}

/** Latitude/longitude dos municípios (sedes) */
const LATLON = {
  'm-teresina': [-5.09, -42.80],
  'm-parnaiba': [-2.90, -41.77],
  'm-luis-correia': [-2.88, -41.67],
  'm-ilha-grande': [-2.86, -41.82],
  'm-cajueiro-da-praia': [-2.93, -41.34],
  'm-picos': [-7.08, -41.47],
  'm-floriano': [-6.77, -43.02],
  'm-sao-raimundo-nonato': [-9.01, -42.70],
  'm-pedro-ii': [-4.42, -41.46],
  'm-piripiri': [-4.27, -41.78],
  'm-piracuruca': [-3.93, -41.71],
  'm-campo-maior': [-4.82, -42.17],
  'm-oeiras': [-7.02, -42.13],
  'm-bom-jesus': [-9.07, -44.36],
  'm-valenca-do-piaui': [-6.40, -41.75],
  'm-esperantina': [-3.90, -42.23],
  'm-uniao': [-4.59, -42.86],
  'm-barras': [-4.24, -42.29],
  'm-jose-de-freitas': [-4.76, -42.58],
  'm-regeneracao': [-6.24, -42.69],
  'm-altos': [-5.04, -42.46],
  'm-pio-ix': [-6.83, -40.58],
  'm-urucui': [-7.23, -44.55],
  'm-corrente': [-10.44, -45.16],
  'm-paulistana': [-8.13, -41.15],
  'm-batalha': [-4.02, -42.08],
  'm-sao-joao-do-piaui': [-8.35, -42.24],
  'm-simplicio-mendes': [-7.85, -41.90],
  'm-canto-do-buriti': [-8.11, -42.94],
  'm-amarante': [-6.24, -42.85],
  'm-capitao-de-campos': [-4.46, -41.94],
  'm-miguel-alves': [-4.16, -42.89],
  'm-luzilandia': [-3.45, -42.37],
  'm-cocal': [-3.47, -41.55],
  'm-castelo-do-piaui': [-5.32, -41.55],
  'm-sao-miguel-do-tapuio': [-5.50, -41.32],
  'm-fronteiras': [-7.08, -40.61],
  'm-jaicos': [-7.36, -41.14],
  'm-guadalupe': [-6.79, -43.56],
  'm-itainopolis': [-7.44, -41.47],
  'm-gilbues': [-9.83, -45.34],
  'm-ribeiro-goncalves': [-7.56, -45.24],
  'm-avelino-lopes': [-10.13, -43.95],
  'm-curimata': [-10.03, -44.30],
  'm-jerumenha': [-7.08, -43.50],
  'm-landri-sales': [-7.26, -43.94],
  'm-manoel-emidio': [-8.01, -43.87],
  'm-matias-olimpio': [-3.71, -42.55],
  'm-monsenhor-gil': [-5.56, -42.61],
  'm-demerval-lobao': [-5.36, -42.68],
  'm-agua-branca': [-5.89, -42.64],
  'm-inhuma': [-6.67, -41.71],
  'm-ipiranga-do-piaui': [-6.83, -41.74],
  'm-dom-expedito-lopes': [-6.94, -41.64],
  'm-elesbao-veloso': [-6.20, -42.14],
  'm-francinopolis': [-6.39, -42.26],
  'm-sao-pedro-do-piaui': [-5.93, -42.72],
  'm-angical-do-piaui': [-6.09, -42.74],
  'm-agricolandia': [-5.80, -42.67],
  'm-santa-cruz-do-piaui': [-7.18, -41.76],
  'm-sao-jose-do-peixe': [-7.28, -42.57],
  'm-itaueira': [-7.60, -43.03],
  'm-cristino-castro': [-8.82, -44.22],
  'm-palmeira-do-piaui': [-8.73, -44.24],
  'm-monte-alegre-do-piaui': [-9.75, -45.30],
  'm-parnagua': [-10.23, -44.63],
  'm-caracol': [-9.28, -43.33],
  'm-anisio-de-abreu': [-9.19, -43.05],
  'm-jurema': [-9.23, -43.13],
  'm-fartura-do-piaui': [-9.48, -42.79],
  'm-dirceu-arcoverde': [-9.34, -42.44],
  'm-dom-inocencio': [-9.00, -41.97],
  'm-sao-braz-do-piaui': [-9.06, -42.92],
  'm-bonfim-do-piaui': [-9.16, -42.88],
  'm-varzea-branca': [-9.24, -42.97],
  'm-coronel-jose-dias': [-8.80, -42.51],
  'm-joao-costa': [-8.51, -42.42],
  'm-capitao-gervasio-oliveira': [-8.55, -41.83],
  'm-lagoa-do-barro-do-piaui': [-8.48, -41.51],
  'm-queimada-nova': [-8.57, -41.41],
  'm-betania-do-piaui': [-8.14, -40.79],
  'm-curral-novo-do-piaui': [-7.83, -40.90],
  'm-jacobina-do-piaui': [-7.94, -41.20],
  'm-acaua': [-8.22, -41.08],
  'm-patos-do-piaui': [-7.68, -41.24],
  'm-campinas-do-piaui': [-7.66, -41.88],
  'm-isaias-coelho': [-7.74, -41.67],
  'm-conceicao-do-caninde': [-7.87, -41.60],
  'm-santo-inacio-do-piaui': [-7.42, -41.91],
  'm-floresta-do-piaui': [-7.46, -41.79],
  'm-oeiras-do-piaui': [-7.02, -42.13],
  'm-colonia-do-piaui': [-7.22, -42.18],
  'm-sao-joao-da-varjota': [-6.97, -41.88],
  'm-wall-ferraz': [-7.23, -41.90],
  'm-paqueta': [-7.09, -41.73],
  'm-aroeiras-do-itaim': [-7.24, -41.55],
  'm-geminiano': [-7.15, -41.34],
  'm-sussuapara': [-7.03, -41.38],
  'm-bocaina': [-6.94, -41.32],
  'm-santana-do-piaui': [-6.94, -41.51],
  'm-sao-luis-do-piaui': [-6.82, -41.32],
  'm-sao-jose-do-piaui': [-6.87, -41.47],
  'm-alagoinha-do-piaui': [-7.00, -40.93],
  'm-alegrete-do-piaui': [-7.24, -40.85],
  'm-francisco-santos': [-6.99, -41.13],
  'm-monsenhor-hipolito': [-6.99, -41.03],
  'm-santo-antonio-de-lisboa': [-6.99, -41.23],
  'm-campo-grande-do-piaui': [-7.13, -41.03],
  'm-vila-nova-do-piaui': [-7.13, -40.93],
  'm-caldeirao-grande-do-piaui': [-7.33, -40.63],
  'm-marcolandia': [-7.44, -40.66],
  'm-caridade-do-piaui': [-7.73, -40.98],
  'm-simoes': [-7.60, -40.82],
  'm-massape-do-piaui': [-7.47, -41.11],
  'm-belem-do-piaui': [-7.35, -40.97],
  'm-padre-marcos': [-7.35, -40.90],
  'm-francisco-macedo': [-7.33, -40.79],
};

/** Centro aproximado de cada regional (fallback) */
const REGIONAL_LATLON = {
  'r-planicie-litoranea': [-3.05, -41.75],
  'r-cocais': [-4.10, -41.90],
  'r-carnaubais': [-4.80, -42.00],
  'r-entre-rios': [-5.20, -42.60],
  'r-vale-do-sambito': [-6.25, -41.90],
  'r-vale-do-canide': [-7.00, -42.20],
  'r-vale-dos-rios-guaribas': [-7.15, -41.35],
  'r-vale-do-itaim': [-7.70, -41.15],
  'r-vale-rios-piaui-itaueira': [-7.20, -43.00],
  'r-alto-do-parnaiba': [-7.80, -44.80],
  'r-serra-da-capivara': [-8.90, -42.60],
  'r-mangabeiras': [-9.80, -44.60],
};

function hashJitter(id, range = 1.6) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return ((Math.abs(h) % 100) / 100 - 0.5) * range;
}

export function getMunicipioMapCoords(munId) {
  const ll = LATLON[munId];
  if (ll) return project(ll[0], ll[1]);

  const mun = MUNICIPIOS.find((m) => m.id === munId);
  const regLL = mun ? REGIONAL_LATLON[mun.regionalId] : null;
  if (regLL) {
    const base = project(regLL[0], regLL[1]);
    return {
      x: Math.max(IMG_BOX.xMin + 2, Math.min(IMG_BOX.xMax - 2, base.x + hashJitter(munId) * 2.2)),
      y: Math.max(IMG_BOX.yMin + 2, Math.min(IMG_BOX.yMax - 2, base.y + hashJitter(`${munId}-y`) * 2.2)),
    };
  }
  return { x: 50, y: 50 };
}

export function getMunicipioMapCoordsWithName(munId, fallbackNome = 'Município') {
  const coords = getMunicipioMapCoords(munId);
  const mun = MUNICIPIOS.find((m) => m.id === munId);
  return { ...coords, nome: mun?.nome || fallbackNome };
}
