import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getRegionalById, formatDate, getStatusBadgeClass, programacaoHasMunicipio } from '../data/seed.js';
import { isAutorizada, isRealizada, normalizeStatus, getStatusRowClass } from '../utils/status.js';
import { bindTabs } from '../components/ui.js';

function renderMunicipioCards(municipios, programacoes) {
  if (!municipios.length) {
    return '<p class="text-muted text-center" style="grid-column:1/-1;padding:24px">Nenhum município nesta regional.</p>';
  }
  return municipios.map((m) => {
    const count = programacoes.filter((p) => programacaoHasMunicipio(p, m.id)).length;
    const coord = getCoordenacaoById(m.coordenacaoId);
    const reg = getRegionalById(m.regionalId);
    return `
      <div class="coord-card" data-mun-id="${m.id}">
        <h3>${m.nome}</h3>
        <p>${reg?.nome || ''}</p>
        <p class="text-sm text-muted">${coord?.nome || '—'} · ${count} programações</p>
      </div>
    `;
  }).join('');
}

export function renderMunicipios(user, params = []) {
  if (params[0]) {
    if (params[1] === 'canceladas-reprovadas') {
      return renderMunicipioCanceladasReprovadas(params[0]);
    }
    return renderMunicipioDetail(params[0]);
  }

  const municipios = getCollection('municipios');
  const regionais = getCollection('regionais');
  const programacoes = getCollection('programacoes');

  return `
    <div class="page-header"><h2>Municípios</h2></div>
    <div class="filters-bar mb-3">
      <div class="form-group">
        <label>Regional de Saúde</label>
        <select class="form-control" id="filtro-regional">
          <option value="">Todas as regionais</option>
          ${regionais.map((r) => `<option value="${r.id}">${r.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group flex-2">
        <label>Buscar município</label>
        <input type="search" class="form-control" id="filtro-mun-busca" placeholder="Nome do município..." />
      </div>
    </div>
    <div class="grid-3" id="grid-municipios">
      ${renderMunicipioCards(municipios, programacoes)}
    </div>
  `;
}

function groupByStatus(programacoes) {
  const programadas = programacoes.filter((p) => normalizeStatus(p.status) === 'Programada');
  const autorizadas = programacoes.filter((p) => isAutorizada(p.status));
  const realizadas = programacoes.filter((p) => isRealizada(p.status));
  const canceladasReprovadas = programacoes.filter((p) => {
    const s = normalizeStatus(p.status);
    return s === 'Cancelada' || s === 'Reprovada';
  });
  return { programadas, autorizadas, realizadas, canceladasReprovadas };
}

function renderMunicipioDetail(munId) {
  const mun = getCollection('municipios').find((m) => m.id === munId);
  if (!mun) return '<p>Município não encontrado.</p>';

  const coord = getCoordenacaoById(mun.coordenacaoId);
  const reg = getRegionalById(mun.regionalId);
  const programacoes = getCollection('programacoes').filter((p) => programacaoHasMunicipio(p, munId));
  const { programadas, autorizadas, realizadas, canceladasReprovadas } = groupByStatus(programacoes);

  return `
    <div class="page-header">
      <div>
        <a href="#municipios" class="text-sm">← Voltar</a>
        <h2>${mun.nome}</h2>
        <p class="text-muted">${reg?.nome || ''}</p>
      </div>
      <a href="#municipios/${munId}/canceladas-reprovadas" class="btn btn-outline">
        Canceladas e Reprovadas (${canceladasReprovadas.length})
      </a>
    </div>

    <div class="detail-grid mb-3">
      <div class="detail-item"><label>Coordenação responsável</label><span>${coord?.nome || '—'}</span></div>
      <div class="detail-item"><label>Regional de Saúde</label><span>${reg?.nome || '—'}</span></div>
      <div class="detail-item"><label>Gerência</label><span>${coord?.gerencia || '—'}</span></div>
    </div>

    <div class="tabs" id="mun-tabs">
      <button class="tab active" data-tab="programadas">Programadas (${programadas.length})</button>
      <button class="tab" data-tab="autorizadas">Autorizadas (${autorizadas.length})</button>
      <button class="tab" data-tab="realizadas">Realizadas (${realizadas.length})</button>
    </div>

    <div class="tab-content active" data-tab-content="programadas">
      ${renderProgTable(programadas)}
    </div>
    <div class="tab-content" data-tab-content="autorizadas">
      ${renderProgTable(autorizadas)}
    </div>
    <div class="tab-content" data-tab-content="realizadas">
      ${renderProgTable(realizadas)}
    </div>
  `;
}

function renderMunicipioCanceladasReprovadas(munId) {
  const mun = getCollection('municipios').find((m) => m.id === munId);
  if (!mun) return '<p>Município não encontrado.</p>';

  const reg = getRegionalById(mun.regionalId);
  const programacoes = getCollection('programacoes').filter((p) => programacaoHasMunicipio(p, munId));
  const { canceladasReprovadas } = groupByStatus(programacoes);
  const canceladas = canceladasReprovadas.filter((p) => normalizeStatus(p.status) === 'Cancelada');
  const reprovadas = canceladasReprovadas.filter((p) => normalizeStatus(p.status) === 'Reprovada');

  return `
    <div class="page-header">
      <div>
        <a href="#municipios/${munId}" class="text-sm">← Voltar para ${mun.nome}</a>
        <h2>Canceladas e Reprovadas</h2>
        <p class="text-muted">${mun.nome}${reg?.nome ? ` · ${reg.nome}` : ''}</p>
      </div>
    </div>

    <div class="tabs" id="mun-tabs">
      <button class="tab active" data-tab="canceladas">Canceladas (${canceladas.length})</button>
      <button class="tab" data-tab="reprovadas">Reprovadas (${reprovadas.length})</button>
      <button class="tab" data-tab="todas">Todas (${canceladasReprovadas.length})</button>
    </div>

    <div class="tab-content active" data-tab-content="canceladas">
      ${renderProgTable(canceladas)}
    </div>
    <div class="tab-content" data-tab-content="reprovadas">
      ${renderProgTable(reprovadas)}
    </div>
    <div class="tab-content" data-tab-content="todas">
      ${renderProgTable(canceladasReprovadas)}
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
              return `<tr class="${getStatusRowClass(p.status)}"><td>${p.titulo}</td><td>${coord?.nome || '—'}</td><td>${formatDate(p.dataInicial)}</td>
                <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td></tr>`;
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

  const refresh = () => {
    const grid = document.getElementById('grid-municipios');
    if (!grid) return;
    let municipios = getCollection('municipios');
    const programacoes = getCollection('programacoes');
    const regional = document.getElementById('filtro-regional')?.value;
    const busca = document.getElementById('filtro-mun-busca')?.value?.toLowerCase().trim();
    if (regional) municipios = municipios.filter((m) => m.regionalId === regional);
    if (busca) municipios = municipios.filter((m) => m.nome.toLowerCase().includes(busca));
    grid.innerHTML = renderMunicipioCards(municipios, programacoes);
    grid.querySelectorAll('.coord-card[data-mun-id]').forEach((card) => {
      card.addEventListener('click', () => {
        window.location.hash = `municipios/${card.dataset.munId}`;
      });
    });
  };

  document.getElementById('filtro-regional')?.addEventListener('change', refresh);
  document.getElementById('filtro-mun-busca')?.addEventListener('input', refresh);

  document.querySelectorAll('.coord-card[data-mun-id]').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.hash = `municipios/${card.dataset.munId}`;
    });
  });
}
