import { getCollection, getSeedProgramacoesCount, importProgramacoesSeed, deleteAllProgramacoes } from '../services/storage.js';
import { getAnexos, subscribeAnexos, openAnexo } from '../services/anexos-service.js';
import {
  saveCoordenacao, removeCoordenacao, saveMunicipio, removeMunicipio, saveRegional, removeRegional,
} from '../services/catalog-service.js';
import { promoteUserToAdmin } from '../services/suporte-service.js';
import {
  getUsers, getAcessos, subscribeUsers, subscribeAcessos, setUserAtivo, firstAccessEmails, initUsersAdminSync,
} from '../services/users-service.js';
import { isAdmin } from '../services/roles.js';
import { GERENCIAS, getCoordenacaoById } from '../data/seed.js';
import { confirmDialog, toast, showModal } from '../components/ui.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
      <td>${esc(a.programacaoTitulo) || '—'}</td>
      <td>${esc(coord?.nome) || '—'}</td>
      <td>${esc(a.nomeArquivo) || '—'}</td>
      <td>${esc(a.enviadoPorNome) || '—'}</td>
      <td>
        <button type="button" class="btn btn-outline btn-sm" data-open-anexo="${a.id}">Abrir</button>
      </td>
    </tr>`;
  }).join('');
}

function renderContasRows(currentUid) {
  const users = getUsers();
  if (!users.length) {
    return '<tr><td colspan="6" class="text-center text-muted">Nenhuma conta cadastrada ainda.</td></tr>';
  }
  return users.map((u) => {
    const ativo = u.ativo !== false;
    const role = u.role === 'admin' ? 'Admin' : 'Usuário';
    const isSelf = u.id === currentUid;
    return `<tr class="${ativo ? '' : 'row-status-cancelada'}">
      <td>${esc(u.nome) || '—'}</td>
      <td>${esc(u.email) || '—'}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-autorizada' : 'badge-rascunho'}">${role}</span></td>
      <td><span class="badge ${ativo ? 'badge-realizada' : 'badge-cancelada'}">${ativo ? 'Ativa' : 'Desativada'}</span></td>
      <td><small>${u.atualizadoEm ? new Date(u.atualizadoEm).toLocaleString('pt-BR') : '—'}</small></td>
      <td>
        ${isSelf ? '<span class="text-muted text-sm">Sua conta</span>' : `
          <button type="button" class="btn btn-sm ${ativo ? 'btn-danger' : 'btn-outline'}" data-toggle-ativo="${u.id}" data-ativo="${ativo ? '1' : '0'}">
            ${ativo ? 'Desativar' : 'Reativar'}
          </button>`}
      </td>
    </tr>`;
  }).join('');
}

function renderAcessosRows() {
  const acessos = getAcessos();
  const novos = firstAccessEmails(acessos);
  if (!acessos.length) {
    return '<tr><td colspan="4" class="text-center text-muted">Nenhum acesso registrado ainda.</td></tr>';
  }
  return acessos.map((a) => {
    const email = String(a.email || '').toLowerCase();
    const novo = novos.has(email);
    return `<tr class="${novo ? 'row-status-enviada' : ''}">
      <td><small>${a.criadoEm ? new Date(a.criadoEm).toLocaleString('pt-BR') : '—'}</small></td>
      <td>${esc(a.nome) || '—'}${novo ? ' <span class="badge badge-enviada">Novo / incomum</span>' : ''}</td>
      <td>${esc(a.email) || '—'}</td>
      <td><small class="text-muted">${esc((a.userAgent || '').slice(0, 80))}${a.userAgent && a.userAgent.length > 80 ? '…' : ''}</small></td>
    </tr>`;
  }).join('');
}

export function renderAdministracao(user, params = []) {
  const tabParam = params[0];
  const known = ['coords', 'muns', 'regs', 'anexos', 'admins', 'contas'];
  const activeTab = known.includes(tabParam) ? tabParam : 'coords';
  const coordenacoes = getCollection('coordenacoes');
  const municipios = getCollection('municipios');
  const regionais = getCollection('regionais');
  const anexosCount = getAnexos().length;
  const usersCount = getUsers().length;
  const acessosCount = getAcessos().length;

  return `
    <div class="page-header"><h2>Administração</h2></div>
    <p class="text-muted mb-3">Gerencie coordenações, municípios, regionais, anexos, contas e acessos.</p>
    <div class="tabs" id="admin-tabs">
      <button class="tab ${activeTab === 'coords' ? 'active' : ''}" data-tab="coords">Coordenações</button>
      <button class="tab ${activeTab === 'muns' ? 'active' : ''}" data-tab="muns">Municípios (${municipios.length})</button>
      <button class="tab ${activeTab === 'regs' ? 'active' : ''}" data-tab="regs">Regionais (${regionais.length})</button>
      <button class="tab ${activeTab === 'anexos' ? 'active' : ''}" data-tab="anexos">Anexos (${anexosCount})</button>
      <button class="tab ${activeTab === 'contas' ? 'active' : ''}" data-tab="contas">Contas e acessos (${usersCount})</button>
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
          <tr><td>${esc(c.nome)}</td><td>${esc(c.sigla)}</td>
          <td><span class="gerencia-tag gerencia-${String(c.gerencia || '').toLowerCase()}">${esc(c.gerencia)}</span></td>
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
          return `<tr><td>${esc(m.nome)}</td><td>${esc(reg?.nome) || '—'}</td>
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
          <tr><td>${esc(r.nome)}</td><td>${municipios.filter((m) => m.regionalId === r.id).length}</td>
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
    <div class="tab-content ${activeTab === 'contas' ? 'active' : ''}" data-tab-content="contas">
      <div class="card" style="margin-top:12px"><div class="card-body">
        <h3>Contas cadastradas (${usersCount})</h3>
        <p class="text-sm text-muted mb-3">Gerencie quem pode entrar no sistema. Contas desativadas são bloqueadas no próximo acesso.</p>
        <div class="table-wrapper" style="max-height:360px;overflow:auto">
          <table id="tabela-contas">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Atualizado</th><th>Ação</th></tr></thead>
            <tbody>${renderContasRows(user?.uid)}</tbody>
          </table>
        </div>
      </div></div>
      <div class="card mt-3"><div class="card-body">
        <h3>Quem acessou o site (${acessosCount})</h3>
        <p class="text-sm text-muted mb-3">Últimos acessos. Linhas em amarelo / badge <strong>Novo / incomum</strong> indicam e-mails com poucos registros (possível acesso fora do comum).</p>
        <div class="table-wrapper" style="max-height:420px;overflow:auto">
          <table id="tabela-acessos">
            <thead><tr><th>Quando</th><th>Nome</th><th>E-mail</th><th>Navegador</th></tr></thead>
            <tbody>${renderAcessosRows()}</tbody>
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
  let payload = null;
  const action = await showModal({
    title: id ? 'Editar coordenação' : 'Nova coordenação',
    body: `<div class="form-group"><label>Nome completo</label><input class="form-control" id="adm-coord-nome" value="${c.nome || ''}"/></div>
      <div class="form-row"><div class="form-group"><label>Sigla</label><input class="form-control" id="adm-coord-sigla" value="${c.sigla || ''}"/></div>
      <div class="form-group"><label>Gerência</label><select class="form-control" id="adm-coord-ger">${GERENCIAS.map((g) => `<option ${c.gerencia === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div></div>`,
    footer: '<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button><button class="btn btn-primary" data-modal-action="save">Salvar</button>',
    onAction: (act, overlay) => {
      if (act !== 'save') return;
      const nome = overlay.querySelector('#adm-coord-nome')?.value.trim() || '';
      const sigla = overlay.querySelector('#adm-coord-sigla')?.value.trim() || '';
      const gerencia = overlay.querySelector('#adm-coord-ger')?.value || 'GAS';
      if (!nome || !sigla) {
        toast('Informe nome e sigla da coordenação.', 'error');
        return false;
      }
      payload = { nome, sigla, gerencia };
    },
  });
  if (action !== 'save' || !payload) return;
  await saveCoordenacao(payload, id);
  toast('Coordenação salva.', 'success');
  window.location.hash = 'administracao';
}

async function formMun(id = null) {
  const muns = getCollection('municipios');
  const regs = getCollection('regionais');
  const m = id ? muns.find((x) => x.id === id) : { nome: '', regionalId: regs[0]?.id || '' };
  let payload = null;
  const action = await showModal({
    title: id ? 'Editar município' : 'Novo município',
    body: `<div class="form-group"><label>Nome</label><input class="form-control" id="adm-mun-nome" value="${m.nome || ''}"/></div>
      <div class="form-group"><label>Regional</label><select class="form-control" id="adm-mun-reg">${regs.map((r) => `<option value="${r.id}" ${m.regionalId === r.id ? 'selected' : ''}>${r.nome}</option>`).join('')}</select></div>`,
    footer: '<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button><button class="btn btn-primary" data-modal-action="save">Salvar</button>',
    onAction: (act, overlay) => {
      if (act !== 'save') return;
      const nome = overlay.querySelector('#adm-mun-nome')?.value.trim() || '';
      const regionalId = overlay.querySelector('#adm-mun-reg')?.value || '';
      if (!nome) {
        toast('Informe o nome do município.', 'error');
        return false;
      }
      payload = { nome, regionalId };
    },
  });
  if (action !== 'save' || !payload) return;
  await saveMunicipio(payload, id);
  toast('Município salvo.', 'success');
  window.location.hash = 'administracao';
}

async function formReg(id = null) {
  const regs = getCollection('regionais');
  const r = id ? regs.find((x) => x.id === id) : { nome: '' };
  let payload = null;
  const action = await showModal({
    title: id ? 'Editar regional' : 'Nova regional',
    body: `<div class="form-group"><label>Nome</label><input class="form-control" id="adm-reg-nome" value="${r.nome || ''}"/></div>`,
    footer: '<button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button><button class="btn btn-primary" data-modal-action="save">Salvar</button>',
    onAction: (act, overlay) => {
      if (act !== 'save') return;
      const nome = overlay.querySelector('#adm-reg-nome')?.value.trim() || '';
      if (!nome) {
        toast('Informe o nome da regional.', 'error');
        return false;
      }
      payload = { nome };
    },
  });
  if (action !== 'save' || !payload) return;
  await saveRegional(payload, id);
  toast('Regional salva.', 'success');
  window.location.hash = 'administracao';
}

export function bindAdministracao(user, params = []) {
  initUsersAdminSync();

  const refreshAnexosTable = () => {
    const tbody = document.querySelector('#tabela-anexos tbody');
    if (tbody) tbody.innerHTML = renderAnexosRows();
    const tab = document.querySelector('#admin-tabs [data-tab="anexos"]');
    if (tab) tab.textContent = `Anexos (${getAnexos().length})`;
  };

  const refreshContasTables = () => {
    const contasBody = document.querySelector('#tabela-contas tbody');
    if (contasBody) contasBody.innerHTML = renderContasRows(user?.uid);
    const acessosBody = document.querySelector('#tabela-acessos tbody');
    if (acessosBody) acessosBody.innerHTML = renderAcessosRows();
    const tab = document.querySelector('#admin-tabs [data-tab="contas"]');
    if (tab) tab.textContent = `Contas e acessos (${getUsers().length})`;
  };

  if (params[0] === 'anexos') refreshAnexosTable();
  if (params[0] === 'contas') refreshContasTables();

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
      if (tab.dataset.tab === 'contas') refreshContasTables();
    });
  });
  document.getElementById('btn-promote-admin')?.addEventListener('click', async () => {
    const email = document.getElementById('promote-admin-email')?.value?.trim();
    if (!email) { toast('Informe o e-mail do usuário.', 'error'); return; }
    try {
      const res = await promoteUserToAdmin(email);
      toast(`${res.nome || res.email} agora é administrador.`, 'success');
      document.getElementById('promote-admin-email').value = '';
      refreshContasTables();
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

  document.querySelector('[data-tab-content="contas"]')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-toggle-ativo]');
    if (!btn) return;
    const uid = btn.dataset.toggleAtivo;
    const currentlyAtivo = btn.dataset.ativo === '1';
    const action = currentlyAtivo ? 'desativar' : 'reativar';
    if ((await confirmDialog(`Deseja ${action} esta conta?`)) !== 'confirm') return;
    btn.disabled = true;
    try {
      await setUserAtivo(uid, !currentlyAtivo);
      toast(currentlyAtivo ? 'Conta desativada.' : 'Conta reativada.', 'success');
      refreshContasTables();
    } catch (err) {
      toast(err.message || 'Erro ao atualizar conta.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  subscribeAnexos(() => {
    if (document.querySelector('#tabela-anexos')) refreshAnexosTable();
  });
  subscribeUsers(() => {
    if (document.querySelector('#tabela-contas')) refreshContasTables();
  });
  subscribeAcessos(() => {
    if (document.querySelector('#tabela-acessos')) refreshContasTables();
  });

  document.getElementById('tabela-anexos')?.closest('.tab-content')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-open-anexo]');
    if (!btn) return;
    const anexo = getAnexos().find((a) => a.id === btn.dataset.openAnexo);
    if (!anexo) { toast('Anexo não encontrado.', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'Abrindo...';
    try {
      await openAnexo(anexo);
    } catch (err) {
      toast(err.message || 'Erro ao abrir anexo.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Abrir';
    }
  });

  return refreshAnexosTable;
}
