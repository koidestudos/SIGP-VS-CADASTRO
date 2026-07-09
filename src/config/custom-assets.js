/**
 * Imagens personalizadas — coloque seus arquivos em public/assets/custom/
 *
 * logo-sesapi.png (ou .jpg / .webp) — logo da SESAPI
 * mapa-piaui.png   (ou .jpg / .webp) — mapa do Piauí para o BI Gerencial
 *
 * Se o arquivo personalizado não existir, o sistema usa o SVG padrão.
 */
export const CUSTOM_ASSET_PATHS = {
  logoSesapi: [
    '/assets/custom/logo-sesapi.png',
    '/assets/custom/logo-sesapi.jpg',
    '/assets/custom/logo-sesapi.webp',
    '/assets/logo-sesapi.svg',
  ],
  mapaPiaui: [
    '/assets/custom/mapa-piaui.png',
    '/assets/custom/mapa-piaui.jpg',
    '/assets/custom/mapa-piaui.webp',
    '/assets/mapa-piaui.svg',
  ],
};

function buildOnError(fallbacks) {
  if (!fallbacks.length) return '';
  const [next, ...rest] = fallbacks;
  if (!rest.length) return `this.onerror=null;this.src='${next}'`;
  return `this.onerror=function(){this.onerror=function(){${buildOnError(rest)}};this.src='${next}';}`;
}

export function assetImgHtml(paths, { alt = '', className = '', id = '' } = {}) {
  const list = Array.isArray(paths) ? paths : [paths];
  const [primary, ...fallbacks] = list;
  const onerror = fallbacks.length ? buildOnError(fallbacks) : '';
  return `<img src="${primary}" alt="${alt}" class="${className}" ${id ? `id="${id}"` : ''} ${onerror ? `onerror="${onerror}"` : ''} />`;
}

export async function loadAssetImage(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  for (const src of list) {
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = src;
      });
      return { img, src };
    } catch {
      /* tenta próximo */
    }
  }
  return null;
}
