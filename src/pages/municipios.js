import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getRegionalById, formatDate, getStatusBadgeClass } from '../data/seed.js';
import { bindTabs } from '../components/ui.js';

export function renderMunicipios(user, params = []) {
  if (params[0]) {
    return renderMunicipioDetail(params[0]);
  }

  const municipios = getCollection('municipios');
  const programacoes = getCollection('programacoes');

  return `
    <div class="page-header"><h2>Municípios</h2></div>
    <div class="grid-3" id="grid-municipios">
      ${municipios.map((m) => {
        const count = programacoes.filter((p) => p.municipioId === m.id).length;
        const coord = getCoordenacaoById(m.coordenacaoId);
        const reg = getRegionalById(m.regionalId);
        return `
          <div class="coord-card" data-mun-id="${m.id}">
            <h3>${m.nome}</h3>
            <p>${reg?.nome || ''}</p>
            <p class="text-sm text-muted">${coord?.sigla || '—'} · ${count} programações</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMunicipioDetail(munId) {
  const mun = getCollection('municipios').find((m) => m.id === munId);
  if (!mun) return '<p>Município não encontrado.</p>';

  const coord = getCoordenacaoById(mun.coordenacaoId);
  const reg = getRegionalById(mun.regionalId);
  const programacoes = getCollection('programacoes').filter((p) => p.municipioId === munId);
  const previstas = programacoes.filter((p) => !['Aprovado', 'Cancelada'].includes(p.status));
  const realizadas = programacoes.filter((p) => p.status === 'Aprovado');

  return `
    <div class="page-header">
      <div>
        <a href="#municipios" class="text-sm">← Voltar</a>
        <h2>${mun.nome}</h2>
        <p class="text-muted">${reg?.nome || ''}</p>
      </div>
    </div>

    <div class="detail-grid mb-3">
      <div class="detail-item"><label>Coordenação responsável</label><span>${coord?.nome || '—'}</span></div>
      <div class="detail-item"><label>Regional de Saúde</label><span>${reg?.nome || '—'}</span></div>
      <div class="detail-item"><label>Gerência</label><span>${coord?.gerencia || '—'}</span></div>
    </div>

    <div class="tabs" id="mun-tabs">
      <button class="tab active" data-tab="prev">Programações previstas</button>
      <button class="tab" data-tab="real">Programações realizadas</button>
      <button class="tab" data-tab="docs">Documentos</button>
      <button class="tab" data-tab="mapa">Mapa</button>
    </div>

    <div class="tab-content active" data-tab-content="prev">
      ${renderProgTable(previstas)}
    </div>
    <div class="tab-content" data-tab-content="real">
      ${renderProgTable(realizadas)}
    </div>
    <div class="tab-content" data-tab-content="docs">
      <div class="card"><div class="card-body">
        ${programacoes.flatMap((p) => p.documentos || []).length ? `
          <ul class="file-list">
            ${programacoes.flatMap((p) => (p.documentos || []).map((d) => `<li>📄 ${d.nome}</li>`)).join('')}
          </ul>
        ` : '<p class="text-muted text-center">Nenhum documento.</p>'}
      </div></div>
    </div>
    <div class="tab-content" data-tab-content="mapa">
      <div class="map-placeholder">🗺 Mapa de ${mun.nome} — Piauí<br><span class="text-sm">Integração com mapa disponível em versão futura</span></div>
    </div>
  `;
}

function renderProgTable(items) {
  return `
    <div class="card"><div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Ação</th><th>Coordenação</th><th>Data</th><th>Status</th></tr></thead>
          <tbody>
            ${items.length ? items.map((p) => {
              const coord = getCoordenacaoById(p.coordenacaoId);
              return `<tr><td>${p.titulo}</td><td>${coord?.sigla || '—'}</td><td>${formatDate(p.dataInicial)}</td>
                <td><span class="badge ${getStatusBadgeClass(p.status)}">${p.status}</span></td></tr>`;
            }).join('') : '<tr><td colspan="4" class="text-center text-muted">Nenhuma programação.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div></div>
  `;
}

export function bindMunicipios(user, params) {
  if (params[0]) {
    const container = document.getElementById('mun-tabs')?.parentElement;
    if (container) bindTabs(container);
    return;
  }

  document.querySelectorAll('.coord-card[data-mun-id]').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.hash = `municipios/${card.dataset.munId}`;
    });
  });
}
