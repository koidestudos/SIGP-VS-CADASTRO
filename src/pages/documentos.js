import { getCollection } from '../services/storage.js';
import { getCoordenacaoById, getMunicipioById, formatDate } from '../data/seed.js';

const DOC_TIPOS = ['Ofícios', 'Cronogramas', 'Listas de presença', 'Relatórios', 'Fotos', 'Atas'];

export function renderDocumentos(user) {
  const programacoes = getCollection('programacoes');
  const allDocs = [];

  programacoes.forEach((p) => {
    (p.documentos || []).forEach((d) => {
      allDocs.push({ ...d, programacaoId: p.id, programacaoTitulo: p.titulo, coordenacaoId: p.coordenacaoId, municipioId: p.municipioId });
    });
  });

  return `
    <div class="page-header"><h2>Documentos</h2></div>
    <p class="text-muted mb-3">Centralização de documentos vinculados às programações.</p>

    <div class="filters-bar mb-3">
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control" id="doc-filtro-tipo">
          <option value="">Todos</option>
          ${DOC_TIPOS.map((t) => `<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Buscar</label>
        <input type="text" class="form-control" id="doc-busca" placeholder="Nome do arquivo..." />
      </div>
    </div>

    <div class="grid-3 mb-3">
      ${DOC_TIPOS.map((t) => {
        const count = allDocs.filter((d) => inferTipo(d.nome) === t).length;
        return `<div class="stat-card"><div class="stat-icon blue">📁</div><div class="stat-info"><h3>${count}</h3><p>${t}</p></div></div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="card-body">
        ${allDocs.length ? `
          <ul class="file-list" id="lista-documentos">
            ${allDocs.map((d, i) => {
              const coord = getCoordenacaoById(d.coordenacaoId);
              const mun = getMunicipioById(d.municipioId);
              return `
                <li data-tipo="${inferTipo(d.nome)}" data-nome="${d.nome.toLowerCase()}">
                  📄 <strong>${d.nome}</strong>
                  <span class="text-muted text-sm"> — ${d.programacaoTitulo} · ${coord?.sigla || ''} · ${mun?.nome || ''}</span>
                </li>
              `;
            }).join('')}
          </ul>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <h3>Nenhum documento cadastrado</h3>
            <p>Os documentos são anexados durante o cadastro de programações (Etapa 6).</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function inferTipo(nome) {
  const n = nome.toLowerCase();
  if (n.includes('oficio') || n.includes('ofício')) return 'Ofícios';
  if (n.includes('cronograma')) return 'Cronogramas';
  if (n.includes('presenca') || n.includes('presença') || n.includes('lista')) return 'Listas de presença';
  if (n.includes('relatorio') || n.includes('relatório')) return 'Relatórios';
  if (n.includes('.jpg') || n.includes('.png') || n.includes('foto')) return 'Fotos';
  if (n.includes('ata')) return 'Atas';
  return 'Relatórios';
}

export function bindDocumentos(user) {
  const filtrar = () => {
    const tipo = document.getElementById('doc-filtro-tipo')?.value;
    const busca = document.getElementById('doc-busca')?.value.toLowerCase() || '';
    document.querySelectorAll('#lista-documentos li').forEach((li) => {
      const matchTipo = !tipo || li.dataset.tipo === tipo;
      const matchBusca = !busca || li.dataset.nome.includes(busca);
      li.style.display = matchTipo && matchBusca ? '' : 'none';
    });
  };

  document.getElementById('doc-filtro-tipo')?.addEventListener('change', filtrar);
  document.getElementById('doc-busca')?.addEventListener('input', filtrar);
}
