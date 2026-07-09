/**
 * Coordenadas (% left/top) calibradas para o mapa silhueta do Piauí
 * (imagem personalizada em public/assets/custom/mapa-piaui.png).
 */
import { MUNICIPIOS } from './reference-data.js';

const REGIONAL_CENTROIDS = {
  'r-planicie-litoranea': { x: 58, y: 8 },
  'r-cocais': { x: 62, y: 22 },
  'r-vale-do-canide': { x: 54, y: 18 },
  'r-vale-do-sambito': { x: 68, y: 38 },
  'r-vale-dos-rios-guaribas': { x: 46, y: 46 },
  'r-vale-do-itaim': { x: 50, y: 56 },
  'r-entre-rios': { x: 44, y: 40 },
  'r-carnaubais': { x: 64, y: 12 },
  'r-vale-rios-piaui-itaueira': { x: 42, y: 52 },
  'r-alto-do-parnaiba': { x: 36, y: 74 },
  'r-serra-da-capivara': { x: 52, y: 80 },
  'r-mangabeiras': { x: 70, y: 58 },
};

/** Capitais regionais e municípios-sede com posição fixa no mapa silhueta */
const CITY_COORDS = {
  'm-teresina': { x: 48, y: 26 },
  'm-parnaiba': { x: 62, y: 5 },
  'm-picos': { x: 68, y: 46 },
  'm-floriano': { x: 42, y: 52 },
  'm-sao-raimundo-nonato': { x: 50, y: 78 },
  'm-pedro-ii': { x: 70, y: 16 },
  'm-piripiri': { x: 66, y: 13 },
  'm-campo-maior': { x: 58, y: 22 },
  'm-oeiras': { x: 54, y: 58 },
  'm-bom-jesus': { x: 34, y: 84 },
  'm-valenca-do-piaui': { x: 52, y: 30 },
  'm-esperantina': { x: 74, y: 7 },
  'm-luis-correia': { x: 64, y: 4 },
  'm-uniao': { x: 60, y: 10 },
  'm-barras': { x: 56, y: 15 },
  'm-jose-de-freitas': { x: 50, y: 24 },
  'm-regeneracao': { x: 46, y: 32 },
  'm-altos': { x: 52, y: 28 },
  'm-pio-ix': { x: 44, y: 72 },
  'm-urucui': { x: 38, y: 66 },
  'm-corrente': { x: 40, y: 60 },
  'm-paulistana': { x: 48, y: 64 },
  'm-batalha': { x: 72, y: 9 },
  'm-sao-joao-do-piaui': { x: 46, y: 68 },
  'm-simplicio-mendes': { x: 56, y: 70 },
  'm-canto-do-buriti': { x: 32, y: 76 },
  'm-sao-joao-do-arraiolo': { x: 58, y: 74 },
  'm-amarante': { x: 54, y: 34 },
  'm-capitao-de-campos': { x: 64, y: 28 },
  'm-miguel-alves': { x: 56, y: 12 },
  'm-luzilandia': { x: 68, y: 11 },
  'm-delta': { x: 76, y: 6 },
  'm-cocal': { x: 60, y: 18 },
  'm-fronteiras': { x: 62, y: 42 },
  'm-inhuma': { x: 64, y: 36 },
  'm-jaicos': { x: 66, y: 32 },
  'm-sao-miguel-do-fidalgo': { x: 58, y: 38 },
  'm-agricolandia': { x: 50, y: 20 },
  'm-coivaras': { x: 46, y: 22 },
  'm-demerval-lobao': { x: 48, y: 30 },
  'm-queimada-nova': { x: 42, y: 44 },
  'm-sao-felix-do-piaui': { x: 40, y: 48 },
  'm-geminiano': { x: 60, y: 44 },
  'm-landri-sales': { x: 36, y: 70 },
  'm-gilbues': { x: 34, y: 62 },
  'm-ribeiro-goncalves': { x: 30, y: 68 },
  'm-bom-principio-do-piaui': { x: 72, y: 14 },
  'm-capitao-gervasio-oliveira': { x: 54, y: 76 },
  'm-avelino-lopes': { x: 38, y: 78 },
  'm-bertolinia': { x: 32, y: 72 },
  'm-dom-expedito-lopes': { x: 50, y: 62 },
  'm-francinopolis': { x: 62, y: 24 },
  'm-francisco-santos': { x: 46, y: 74 },
  'm-guadalupe': { x: 44, y: 56 },
  'm-itainopolis': { x: 52, y: 66 },
  'm-jacobina-do-piaui': { x: 48, y: 54 },
  'm-joaquim-pires': { x: 64, y: 20 },
  'm-lagoa-do-barro-do-piaui': { x: 36, y: 58 },
  'm-manoel-emidio': { x: 28, y: 74 },
  'm-matias-olimpio': { x: 70, y: 20 },
  'm-monsenhor-gil': { x: 50, y: 18 },
  'm-monsenhor-hipolito': { x: 54, y: 48 },
  'm-nazare-do-piaui': { x: 42, y: 36 },
  'm-palmeira-do-piaui': { x: 46, y: 38 },
  'm-parnarama': { x: 58, y: 26 },
  'm-pio-ix': { x: 44, y: 72 },
  'm-porto-alegre-do-piaui': { x: 56, y: 52 },
  'm-sao-goncalo-do-piaui': { x: 60, y: 50 },
  'm-sao-jose-do-peixe': { x: 52, y: 36 },
  'm-sao-luis-do-piaui': { x: 48, y: 42 },
  'm-sao-pedro-do-piaui': { x: 46, y: 50 },
  'm-sao-joao-da-varjota': { x: 40, y: 54 },
  'm-sao-joao-da-fronteira': { x: 26, y: 80 },
  'm-sao-joao-do-piaui': { x: 46, y: 68 },
  'm-sao-miguel-do-tapuio': { x: 66, y: 26 },
  'm-sao-raulino': { x: 54, y: 42 },
  'm-sao-romao': { x: 62, y: 16 },
  'm-sao-sebastiao-do-piaui': { x: 44, y: 64 },
  'm-sao-joao-da-serra': { x: 48, y: 60 },
  'm-sao-jose-do-divino': { x: 74, y: 12 },
  'm-sao-luis-do-piaui': { x: 48, y: 42 },
};

function hashJitter(id, range = 10) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return (Math.abs(h) % range) - range / 2;
}

export function getMunicipioMapCoords(munId) {
  if (CITY_COORDS[munId]) return { ...CITY_COORDS[munId] };
  const mun = MUNICIPIOS.find((m) => m.id === munId);
  const reg = mun ? REGIONAL_CENTROIDS[mun.regionalId] : null;
  if (reg) {
    return {
      x: Math.max(10, Math.min(90, reg.x + hashJitter(munId))),
      y: Math.max(6, Math.min(92, reg.y + hashJitter(`${munId}-y`))),
    };
  }
  return { x: 50, y: 50 };
}

export function getMunicipioMapCoordsWithName(munId, fallbackNome = 'Município') {
  const coords = getMunicipioMapCoords(munId);
  const mun = MUNICIPIOS.find((m) => m.id === munId);
  return { ...coords, nome: mun?.nome || fallbackNome };
}
