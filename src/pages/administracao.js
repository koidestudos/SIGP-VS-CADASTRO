import { getCollection, getSeedProgramacoesCount, importProgramacoesSeed } from '../services/storage.js';
import { isAdmin } from '../services/roles.js';
import { GERENCIAS } from '../data/seed.js';
import { confirmDialog, toast } from '../components/ui.js';

export function renderAdministracao(user) {
  const coordenacoes = getCollection('coordenacoes');
  const municipios = getCollection('municipios');
  const regionais = getCollection('regionais');

  return `
    <div class="page-header"><h2>Administração</h2></div>
    <div class="approval-flow mb-3">
      <span class="step">Cadastra programação</span><span class="arrow">→</span>
      <span class="step">Revisa</span><span class="arrow">→</span>
      <span class="step">Aprova</span><span class="arrow">→</span>
      <span class="step">Programada no calendário</span>
    </div>
    <div class="tabs" id="admin-tabs">
      <button class="tab active" data-tab="coords">Coordenações</button>
      <button class="tab" data-tab="muns">Municípios (${municipios.length})</button>
      <button class="tab" data-tab="regs">Regionais (${regionais.length})</button>
    </div>
    <div class="tab-content active" data-tab-content="coords">
      <div class="table-wrapper"><table>
        <thead><tr><th>Nome</th><th>Sigla</th><th>Gerência</th></tr></thead>
        <tbody>${coordenacoes.map((c) => `
          <tr><td>${c.nome}</td><td>${c.sigla}</td>
          <td><span class="gerencia-tag gerencia-${c.gerencia.toLowerCase()}">${c.gerencia}</span></td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="tab-content" data-tab-content="muns">
      <p class="text-muted mb-2">${municipios.length} municípios cadastrados conforme regionais do Piauí.</p>
      <div class="table-wrapper" style="max-height:400px;overflow:auto"><table>
        <thead><tr><th>Município</th><th>Regional</th></tr></thead>
        <tbody>${municipios.map((m) => {
          const reg = regionais.find((r) => r.id === m.regionalId);
          return `<tr><td>${m.nome}</td><td>${reg?.nome || '—'}</td></tr>`;
        }).join('')}</tbody></table></div>
    </div>
    <div class="tab-content" data-tab-content="regs">
      <div class="table-wrapper"><table>
        <thead><tr><th>Regional de Saúde</th><th>Municípios</th></tr></thead>
        <tbody>${regionais.map((r) => `
          <tr><td>${r.nome}</td><td>${municipios.filter((m) => m.regionalId === r.id).length}</td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="card mt-3"><div class="card-body">
      <h3>Programações da planilha Excel (GAS · GAP · GVS)</h3>
      <p class="text-sm text-muted">${getSeedProgramacoesCount()} viagens (Jul/2026 em diante). Branco = <strong>Programada</strong>, verde = <strong>Aprovado</strong>.</p>
      ${isAdmin(user) ? `<button class="btn btn-outline btn-sm mt-2" id="btn-reimport-seed">Reimportar viagens da planilha</button>` : ''}
    </div></div>
    <div class="card mt-3"><div class="card-body">
      <h3>Gerências</h3>
      <p class="text-sm text-muted">${GERENCIAS.join(' · ')} — DUVAS</p>
    </div></div>`;
}

export function bindAdministracao(user) {
  document.getElementById('btn-reimport-seed')?.addEventListener('click', async () => {
    if ((await confirmDialog('Reimportar todas as viagens da planilha Excel? Itens existentes serão atualizados.')) !== 'confirm') return;
    try {
      const res = await importProgramacoesSeed({ force: true });
      toast(`${res.count} programações importadas.`, 'success');
    } catch (err) {
      toast(err.message || 'Erro ao importar.', 'error');
    }
  });
  document.getElementById('admin-tabs')?.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabs = document.getElementById('admin-tabs');
      tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tabs.parentElement.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      tabs.parentElement.querySelector(`[data-tab-content="${tab.dataset.tab}"]`)?.classList.add('active');
    });
  });
}
