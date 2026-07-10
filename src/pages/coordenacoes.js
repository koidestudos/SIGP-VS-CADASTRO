import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getMunicipioById, formatDate, getStatusBadgeClass, GERENCIAS, programacaoHasMunicipio, getMunicipiosLabel } from '../data/seed.js';
import { bindTabs } from '../components/ui.js';
import { normalizeStatus, isInBI, needsApproval } from '../utils/status.js';

export function renderCoordenacoes(user, params = []) {
  if (params[0]) {
    return renderCoordDetail(params[0]);
  }

  const coordenacoes = getCollection('coordenacoes');
  const programacoes = getCollection('programacoes');

  return `
    <div class="page-header"><h2>Coordenações</h2></div>
    <div class="filters-bar mb-3">
      ${GERENCIAS.map((g) => `<button class="btn btn-ghost btn-sm filtro-gerencia" data-gerencia="${g}">${g}</button>`).join('')}
      <button class="btn btn-primary btn-sm filtro-gerencia" data-gerencia="">Todas</button>
    </div>
    <div class="grid-3" id="grid-coordenacoes">
      ${coordenacoes.map((c) => {
        const count = programacoes.filter((p) => p.coordenacaoId === c.id).length;
        const equipeCount = getCollection('equipes').filter((e) => e.coordenacaoId === c.id).length;
        return `
          <div class="coord-card" data-coord-id="${c.id}" data-gerencia="${c.gerencia}">
            <span class="gerencia-tag gerencia-${c.gerencia.toLowerCase()}">${c.gerencia}</span>
            <h3>${c.nome}</h3>
            <p>${count} programações · ${equipeCount} membros na equipe</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCoordDetail(coordId) {
  const coord = getCoordenacaoById(coordId);
  if (!coord) return '<p>Coordenação não encontrada.</p>';

  const programacoes = getCollection('programacoes').filter((p) => p.coordenacaoId === coordId);
  const equipes = getCollection('equipes').filter((e) => e.coordenacaoId === coordId);
  const municipios = getCollection('municipios').filter((m) => m.coordenacaoId === coordId);

  return `
    <div class="page-header">
      <div>
        <a href="#coordenacoes" class="text-sm">← Voltar</a>
        <h2>${coord.nome}</h2>
        <span class="gerencia-tag gerencia-${coord.gerencia.toLowerCase()}">${coord.gerencia}</span>
      </div>
    </div>

    <div class="tabs" id="coord-tabs">
      <button class="tab active" data-tab="progs">Programações</button>
      <button class="tab" data-tab="equipe">Equipe</button>
      <button class="tab" data-tab="docs">Documentos</button>
      <button class="tab" data-tab="rel">Relatórios</button>
      <button class="tab" data-tab="muns">Municípios</button>
    </div>

    <div class="tab-content active" data-tab-content="progs">
      <div class="card"><div class="card-body">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Ação</th><th>Município</th><th>Data</th><th>Status</th></tr></thead>
            <tbody>
              ${programacoes.length ? programacoes.map((p) => {
                const munLabel = getMunicipiosLabel(p);
                return `<tr><td>${p.titulo}</td><td>${munLabel}</td><td>${formatDate(p.dataInicial)}</td>
                  <td><span class="badge ${getStatusBadgeClass(p.status)}">${normalizeStatus(p.status)}</span></td></tr>`;
              }).join('') : '<tr><td colspan="4" class="text-center text-muted">Nenhuma programação.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>

    <div class="tab-content" data-tab-content="equipe">
      <div class="card"><div class="card-body">
        <table>
          <thead><tr><th>Nome</th><th>Cargo</th></tr></thead>
          <tbody>
            ${equipes.length ? equipes.map((e) => `<tr><td>${e.nome}</td><td>${e.cargo}</td></tr>`).join('')
              : '<tr><td colspan="2" class="text-center text-muted">Nenhum membro cadastrado.</td></tr>'}
          </tbody>
        </table>
      </div></div>
    </div>

    <div class="tab-content" data-tab-content="docs">
      <div class="card"><div class="card-body">
        ${programacoes.flatMap((p) => p.documentos || []).length ? `
          <ul class="file-list">
            ${programacoes.flatMap((p) => (p.documentos || []).map((d) => `<li>📄 ${d.nome} <span class="text-muted">(${p.titulo})</span></li>`)).join('')}
          </ul>
        ` : '<p class="text-muted text-center">Nenhum documento vinculado.</p>'}
      </div></div>
    </div>

    <div class="tab-content" data-tab-content="rel">
      <div class="card"><div class="card-body">
        <p>Relatórios disponíveis para <strong>${coord.sigla}</strong>:</p>
        <ul class="mt-2" style="padding-left:20px">
          <li>Programação Mensal — ${programacoes.length} ações</li>
          <li>Programação por Município</li>
          <li>Viagens Autorizadas (BI) — ${programacoes.filter((p) => isInBI(p.status)).length}</li>
          <li>Programações em Análise — ${programacoes.filter((p) => needsApproval(p.status)).length}</li>
        </ul>
        <button class="btn btn-outline btn-sm mt-2" onclick="window.location.hash='relatorios'">Exportar relatórios →</button>
      </div></div>
    </div>

    <div class="tab-content" data-tab-content="muns">
      <div class="grid-3">
        ${municipios.length ? municipios.map((m) => `
          <div class="coord-card" data-mun-id="${m.id}">
            <h3>${m.nome}</h3>
            <p>${programacoes.filter((p) => programacaoHasMunicipio(p, m.id)).length} programações</p>
          </div>
        `).join('') : '<p class="text-muted">Nenhum município vinculado.</p>'}
      </div>
    </div>
  `;
}

export function bindCoordenacoes(user, params) {
  if (params[0]) {
    const tabs = document.getElementById('coord-tabs');
    if (tabs) bindTabs(tabs.parentElement);
    return;
  }

  document.querySelectorAll('.coord-card[data-coord-id]').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.hash = `coordenacoes/${card.dataset.coordId}`;
    });
  });

  document.querySelectorAll('.filtro-gerencia').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.gerencia;
      document.querySelectorAll('.coord-card[data-coord-id]').forEach((card) => {
        card.style.display = !g || card.dataset.gerencia === g ? '' : 'none';
      });
    });
  });
}
