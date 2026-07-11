import { getCollection, getSeedProgramacoesCount, importProgramacoesSeed, deleteAllProgramacoes } from '../services/storage.js';
import { getAnexos, subscribeAnexos } from '../services/anexos-service.js';
import {
  saveCoordenacao, removeCoordenacao, saveMunicipio, removeMunicipio, saveRegional, removeRegional,
} from '../services/catalog-service.js';
import { promoteUserToAdmin } from '../services/suporte-service.js';
import { isAdmin } from '../services/roles.js';
import { GERENCIAS, getCoordenacaoById } from '../data/seed.js';
import { confirmDialog, toast, showModal } from '../components/ui.js';

function renderAnexosRows() {
  const anexos = getAnexos();
  if (!anexos.length) {
    return '<tr><td colspan="6" class="text-center text-muted">Nenhum anexo enviado ainda.</td></tr>';
  }
  return anexos.map((a) => {
    const coord = getCoordenacaoById(a.coordenacaoId);
    const quando = a.enviadoEm ? new Date(a.enviadoEm).toLocaleString('pt-BR') : '—';
    return `<tr>
      <td><small>${quando}</small></td>
      <td>${a.programacaoTitulo || '—'}</td>
      <td>${coord?.nome || '—'}</td>
      <td>${a.nomeArquivo || '—'}</td>
      <td>${a.enviadoPorNome || '—'}</td>
      <td>
        ${a.downloadUrl
          ? `<a class="btn btn-outline btn-sm" href="${a.downloadUrl}" target="_blank" rel="noopener">Abrir</a>`
          : '—'}
      </td>
    </tr>`;
  }).join('');
}

export function renderAdministracao(user, params = []) {
  const activeTab = params[0] === 'anexos' ? 'anexos' : 'coords';
  const coordenacoes = getCollection('coordenacoes');
  const municipios = getCollection('municipios');
  const regionais = getCollection('regionais');
  const anexosCount = getAnexos().length;

  return `
    <div class="page-header"><h2>Administração</h2></div>
    <p class="text-muted mb-3">Gerencie coordenações, municípios, regionais, anexos e importação de viagens.</p>
    <div class="tabs" id="admin-tabs">
      <button class="tab ${activeTab === 'coords' ? 'active' : ''}" data-tab="coords">Coordenações</button>
      <button class="tab ${activeTab === 'muns' ? 'active' : ''}" data-tab="muns">Municípios (${municipios.length})</button>
      <button class="tab ${activeTab === 'regs' ? 'active' : ''}" data-tab="regs">Regionais (${regionais.length})</button>
      <button class="tab ${activeTab === 'anexos' ? 'active' : ''}" data-tab="anexos">Anexos (${anexosCount})</button>
      <button class="tab ${activeTab === 'admins' ? 'active' : ''}" data-tab="admins">Administradores</button>
    </div>
    <div class="tab-content ${activeTab === 'coords' ? 'active' : ''}" data-tab-content="coords">
      <div class="page-header" style="margin-top:12px">
        <span></span>
        <button class="btn btn-primary btn-sm" id="btn-add-coord">+ Nova coordenação</button>
      </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Nome</th><th>Sigla</th><th>Gerência</th><th>Ações</th></tr></thead>
        <tbody>${coordenacoes.map((c) => `
          <tr><td>${c.nome}</td><td>${c.sigla}</td>
          <td><span class="gerencia-tag gerencia-${c.gerencia.toLowerCase()}">${c.gerencia}</span></td>
          <td><button class="btn-icon" data-edit-coord="${c.id}">✏</button>
          <button class="btn-icon danger" data-del-coord="${c.id}">🗑</button></td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="tab-content ${activeTab === 'muns' ? 'active' : ''}" data-tab-content="muns">
      <div class="page-header" style="margin-top:12px">
        <span></span>
        <button class="btn btn-primary btn-sm" id="btn-add-mun">+ Novo município</button>
      </div>
      <div class="table-wrapper" style="max-height:400px;overflow:auto"><table>
        <thead><tr><th>Município</th><th>Regional</th><th>Ações</th></tr></thead>
        <tbody>${municipios.map((m) => {
          const reg = regionais.find((r) => r.id === m.regionalId);
          return `<tr><td>${m.nome}</td><td>${reg?.nome || '—'}</td>
            <td><button class="btn-icon" data-edit-mun="${m.id}">✏</button>
            <button class="btn-icon danger" data-del-mun="${m.id}">🗑</button></td></tr>`;
        }).join('')}</tbody></table></div>
    </div>
    <div class="tab-content ${activeTab === 'regs' ? 'active' : ''}" data-tab-content="regs">
      <div class="page-header" style="margin-top:12px">
        <span></span>
        <button class="btn btn-primary btn-sm" id="btn-add-reg">+ Nova regional</button>
      </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Regional de Saúde</th><th>Municípios</th><th>Ações</th></tr></thead>
        <tbody>${regionais.map((r) => `
          <tr><td>${r.nome}</td><td>${municipios.filter((m) => m.regionalId === r.id).length}</td>
          <td><button class="btn-icon" data-edit-reg="${r.id}">✏</button>
          <button class="btn-icon danger" data-del-reg="${r.id}">🗑</button></td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="tab-content ${activeTab === 'anexos' ? 'active' : ''}" data-tab-content="anexos">
      <div class="card" style="margin-top:12px"><div class="card-body">
        <h3>Anexos de programações</h3>
        <p class="text-sm text-muted mb-3">Documentos enviados pelos usuários, ordenados pela data de entrega (mais recentes primeiro).</p>
        <div class="table-wrapper" style="max-height:480px;overflow:auto">
          <table id="tabela-anexos">
            <thead><tr>
              <th>Enviado em</th><th>Programação</th><th>Coordenação</th><th>Arquivo</th><th>Enviado por</th><th></th>
            </tr></thead>
            <tbody>${renderAnexosRows()}</tbody>
          </table>
        </div>
      </div></div>
    </div>
    <div class="tab-content ${activeTab === 'admins' ? 'active' : ''}" data-tab-content="admins">
      <div class="card" style="margin-top:12px"><div class="card-body">
        <h3>Adicionar administrador</h3>
        <p class="text-sm text-muted mb-2">Informe o e-mail de um usuário que já tenha criado conta no sistema.</p>
        <div class="form-row" style="align-items:flex-end">
          <div class="form-group flex-2">
            <label>E-mail do usuário</label>
            <input type="email" class="form-control" id="promote-admin-email" placeholder="usuario@email.com" />
          </div>
          <button class="btn btn-primary" id="btn-promote-admin">Promover a administrador</button>
        </div>
      </div></div>
    </div>
    <div class="card mt-3"><div class="card-body">
      <h3>Imagens personalizadas</h3>
      <p class="text-sm text-muted">Coloque seus arquivos na pasta <code>public/assets/custom/</code>:</p>
      <ul class="text-sm text-muted">
        <li><strong>logo-sesapi.png</strong> — logo da SESAPI (sidebar e login)</li>
        <li><strong>mapa-piaui.png</strong> — mapa do Piauí (BI Gerencial)</li>
      </ul>
      <p class="text-sm text-muted">Formatos aceitos: PNG, JPG ou WEBP. Se não existir, o SVG padrão é usado.</p>
    </div></div>
    <div class="card mt-3"><div class="card-body">
      <h3>Programações da planilha Excel (GAS · GAP · GVS)</h3>
      <p class="text-sm text-muted">${getSeedProgramacoesCount()} viagens (Jul/2026 em diante). Importadas como <strong>Autorizada</strong> (dados históricos aprovados).</p>
      ${isAdmin(user) ? `
        <div class="mt-2" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" id="btn-reimport-seed">Reimportar viagens da planilha</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-all-prog">Apagar programações e logística</button>
        </div>` : ''}
    </div></div>`;
}

async function formCoord(id = null) {
  const coords = getCollection('coordenacoes');
  const c = id ? coords.find((x) => x.id === id) : { nome: '', sigla: '', gerencia: 'GAS' };
  const action = await showModal({
    title: id ? 'Editar coordenação' : 'Nova coordenação',
    body: `<div class="form-group"><label>Nome completo</label><input class="form-control" id="adm-coord-nome" value="${c.nome || ''}"/></div>
      <div class="form-row"><div class="form-group"><label>Sigla</label><input class="form-control" id="adm-coord-sigla" value="${c.sigla || ''}"/></div>
      <div class="form-group"><label>Gerência</label><select class="form-control" id="adm-coord-ger">${GERENCIAS.map((g) => `<option ${c.gerencia === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div></div>`,
    footer: '<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button><button class="btn btn-primary" data-modal-action="save">Salvar</button>',
  });
  if (action !== 'save') return;
  await saveCoordenacao({
    nome: document.getElementById('adm-coord-nome')?.value.trim(),
    sigla: document.getElementById('adm-coord-sigla')?.value.trim(),
    gerencia: document.getElementById('adm-coord-ger')?.value,
  }, id);
  toast('Coordenação salva.', 'success');
  window.location.hash = 'administracao';
}

async function formMun(id = null) {
  const muns = getCollection('municipios');
  const regs = getCollection('regionais');
  const m = id ? muns.find((x) => x.id === id) : { nome: '', regionalId: regs[0]?.id || '' };
  const action = await showModal({
    title: id ? 'Editar município' : 'Novo município',
    body: `<div class="form-group"><label>Nome</label><input class="form-control" id="adm-mun-nome" value="${m.nome || ''}"/></div>
      <div class="form-group"><label>Regional</label><select class="form-control" id="adm-mun-reg">${regs.map((r) => `<option value="${r.id}" ${m.regionalId === r.id ? 'selected' : ''}>${r.nome}</option>`).join('')}</select></div>`,
    footer: '<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button><button class="btn btn-primary" data-modal-action="save">Salvar</button>',
  });
  if (action !== 'save') return;
  await saveMunicipio({
    nome: document.getElementById('adm-mun-nome')?.value.trim(),
    regionalId: document.getElementById('adm-mun-reg')?.value,
  }, id);
  toast('Município salvo.', 'success');
  window.location.hash = 'administracao';
}

async function formReg(id = null) {
  const regs = getCollection('regionais');
  const r = id ? regs.find((x) => x.id === id) : { nome: '' };
  const action = await showModal({
    title: id ? 'Editar regional' : 'Nova regional',
    body: `<div class="form-group"><label>Nome</label><input class="form-control" id="adm-reg-nome" value="${r.nome || ''}"/></div>`,
    footer: '<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button><button class="btn btn-primary" data-modal-action="save">Salvar</button>',
  });
  if (action !== 'save') return;
  await saveRegional({ nome: document.getElementById('adm-reg-nome')?.value.trim() }, id);
  toast('Regional salva.', 'success');
  window.location.hash = 'administracao';
}

export function bindAdministracao(user, params = []) {
  const refreshAnexosTable = () => {
    const tbody = document.querySelector('#tabela-anexos tbody');
    if (tbody) tbody.innerHTML = renderAnexosRows();
    const tab = document.querySelector('#admin-tabs [data-tab="anexos"]');
    if (tab) tab.textContent = `Anexos (${getAnexos().length})`;
  };

  if (params[0] === 'anexos') {
    refreshAnexosTable();
  }

  document.getElementById('btn-reimport-seed')?.addEventListener('click', async () => {
    if ((await confirmDialog('Reimportar todas as viagens da planilha Excel? Itens existentes serão atualizados.')) !== 'confirm') return;
    try {
      const res = await importProgramacoesSeed({ force: true });
      const msg = res.deleted ? `${res.count} importadas, ${res.deleted} antigas removidas.` : `${res.count} programações importadas.`;
      toast(msg, 'success');
    } catch (err) {
      toast(err.message || 'Erro ao importar.', 'error');
    }
  });
  document.getElementById('btn-delete-all-prog')?.addEventListener('click', async () => {
    if ((await confirmDialog('Apagar TODAS as programações e TODA a logística do sistema? Esta ação não pode ser desfeita.')) !== 'confirm') return;
    try {
      const { programacoes, logistica } = await deleteAllProgramacoes();
      toast(`${programacoes} programação(ões) e ${logistica} registro(s) de logística apagados.`, 'success');
    } catch (err) {
      toast(err.message || 'Erro ao apagar.', 'error');
    }
  });
  document.getElementById('admin-tabs')?.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabs = document.getElementById('admin-tabs');
      tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tabs.parentElement.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      tabs.parentElement.querySelector(`[data-tab-content="${tab.dataset.tab}"]`)?.classList.add('active');
      if (tab.dataset.tab === 'anexos') refreshAnexosTable();
    });
  });
  document.getElementById('btn-promote-admin')?.addEventListener('click', async () => {
    const email = document.getElementById('promote-admin-email')?.value?.trim();
    if (!email) { toast('Informe o e-mail do usuário.', 'error'); return; }
    try {
      const res = await promoteUserToAdmin(email);
      toast(`${res.nome || res.email} agora é administrador.`, 'success');
      document.getElementById('promote-admin-email').value = '';
    } catch (err) {
      toast(err.message || 'Erro ao promover usuário.', 'error');
    }
  });
  document.getElementById('btn-add-coord')?.addEventListener('click', () => formCoord());
  document.getElementById('btn-add-mun')?.addEventListener('click', () => formMun());
  document.getElementById('btn-add-reg')?.addEventListener('click', () => formReg());
  document.querySelectorAll('[data-edit-coord]').forEach((b) => b.addEventListener('click', () => formCoord(b.dataset.editCoord)));
  document.querySelectorAll('[data-edit-mun]').forEach((b) => b.addEventListener('click', () => formMun(b.dataset.editMun)));
  document.querySelectorAll('[data-edit-reg]').forEach((b) => b.addEventListener('click', () => formReg(b.dataset.editReg)));
  document.querySelectorAll('[data-del-coord]').forEach((b) => b.addEventListener('click', async () => {
    if ((await confirmDialog('Excluir coordenação?')) === 'confirm') { await removeCoordenacao(b.dataset.delCoord); toast('Excluída.', 'success'); window.location.hash = 'administracao'; }
  }));
  document.querySelectorAll('[data-del-mun]').forEach((b) => b.addEventListener('click', async () => {
    if ((await confirmDialog('Excluir município?')) === 'confirm') { await removeMunicipio(b.dataset.delMun); toast('Excluído.', 'success'); window.location.hash = 'administracao'; }
  }));
  document.querySelectorAll('[data-del-reg]').forEach((b) => b.addEventListener('click', async () => {
    if ((await confirmDialog('Excluir regional?')) === 'confirm') { await removeRegional(b.dataset.delReg); toast('Excluída.', 'success'); window.location.hash = 'administracao'; }
  }));

  subscribeAnexos(() => {
    if (document.querySelector('#tabela-anexos')) refreshAnexosTable();
  });

  return refreshAnexosTable;
}
