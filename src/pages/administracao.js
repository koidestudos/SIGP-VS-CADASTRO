import { getCollection, getSeedProgramacoesCount, importProgramacoesSeed, deleteAllProgramacoes } from '../services/storage.js';
import { getAnexos, subscribeAnexos, openAnexo, deleteAnexo } from '../services/anexos-service.js';
import {
  saveCoordenacao, removeCoordenacao, saveMunicipio, removeMunicipio, saveRegional, removeRegional,
} from '../services/catalog-service.js';
import { promoteUserToAdmin } from '../services/suporte-service.js';
import {
  getUsers, getAcessos, subscribeUsers, subscribeAcessos, setUserAtivo, firstAccessEmails, initUsersAdminSync, setUserAccess, getUsersSyncError,
} from '../services/users-service.js';
import { isAdmin, canManageUsers, roleLabel, normalizeRole } from '../services/roles.js';
import { GERENCIAS, getCoordenacaoById } from '../data/seed.js';
import { confirmDialog, toast, showModal } from '../components/ui.js';

const ADMIN_TABS = ['coords', 'muns', 'regs', 'anexos', 'admins', 'contas'];
const ADMIN_TAB_KEY = 'sigp-vs-admin-tab';

function persistAdminTab(tab) {
  if (!ADMIN_TABS.includes(tab)) return;
  try { sessionStorage.setItem(ADMIN_TAB_KEY, tab); } catch { /* ignore */ }
}

function resolveAdminTab(params = []) {
  const fromHash = params[0];
  if (ADMIN_TABS.includes(fromHash)) {
    persistAdminTab(fromHash);
    return fromHash;
  }
  try {
    const saved = sessionStorage.getItem(ADMIN_TAB_KEY);
    if (ADMIN_TABS.includes(saved)) return saved;
  } catch { /* ignore */ }
  return 'coords';
}

function goAdminTab(tab) {
  const next = ADMIN_TABS.includes(tab) ? tab : 'coords';
  persistAdminTab(next);
  const hash = `administracao/${next}`;
  if (window.location.hash.slice(1) !== hash) {
    window.location.hash = hash;
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAnexosRows(user) {
  const anexos = getAnexos();
  if (!anexos.length) {
    return '<tr><td colspan="6" class="text-center text-muted">Nenhum anexo enviado ainda.</td></tr>';
  }
  const canDelete = isAdmin(user);
  return anexos.map((a) => {
    const coord = getCoordenacaoById(a.coordenacaoId);
    const quando = a.enviadoEm ? new Date(a.enviadoEm).toLocaleString('pt-BR') : '—';
    return `<tr>
      <td><small>${quando}</small></td>
      <td>${esc(a.programacaoTitulo) || '—'}</td>
      <td>${esc(coord?.nome) || '—'}</td>
      <td>${esc(a.nomeArquivo) || '—'}</td>
      <td>${esc(a.enviadoPorNome) || '—'}</td>
      <td class="table-actions">
        <button type="button" class="btn btn-outline btn-sm" data-open-anexo="${a.id}">Abrir</button>
        ${canDelete ? `<button type="button" class="btn btn-outline-danger btn-sm" data-del-anexo="${a.id}">Excluir</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function formatQuando(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function deviceLabel(ua) {
  const s = String(ua || '');
  if (!s) return '—';
  if (/iPhone|iPad/i.test(s)) return 'iPhone/iPad';
  if (/Android/i.test(s)) return 'Android';
  if (/Edg\//i.test(s)) return 'Edge';
  if (/Chrome\//i.test(s)) return 'Chrome';
  if (/Firefox\//i.test(s)) return 'Firefox';
  if (/Safari\//i.test(s)) return 'Safari';
  return 'Navegador';
}

function renderContasRows(viewer) {
  const users = getUsers();
  const currentUid = viewer?.uid;
  const canManage = canManageUsers(viewer);
  if (!users.length) {
    const syncError = getUsersSyncError();
    if (syncError) {
      return `<div class="alert alert-error">${esc(syncError)}</div>`;
    }
    return `<div class="admin-empty">Nenhuma conta carregada no momento. Se as pessoas ainda entram no sistema, as contas continuam no Firebase — atualize a página (Ctrl+F5).</div>`;
  }
  return `<div class="admin-account-list">${users.map((u) => {
    const ativo = u.ativo !== false;
    const role = roleLabel({ role: normalizeRole(u.role), gerencia: u.gerencia });
    const isSelf = u.id === currentUid;
    const initials = String(u.nome || u.email || '?')
      .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
    const roleEditor = canManage && !isSelf ? `
      <div class="admin-role-row">
        <select class="form-control btn-sm" data-set-role="${u.id}">
          <option value="usuario" ${!u.role || u.role === 'usuario' ? 'selected' : ''}>Coordenação</option>
          <option value="gerencia" ${u.role === 'gerencia' ? 'selected' : ''}>Gerência</option>
          <option value="diretoria" ${u.role === 'diretoria' ? 'selected' : ''}>Diretoria</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
        <select class="form-control btn-sm ${u.role === 'gerencia' ? '' : 'hidden'}" data-set-gerencia="${u.id}">
          <option value="">Gerência...</option>
          ${GERENCIAS.map((g) => `<option value="${g}" ${u.gerencia === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>` : '';
    return `
      <article class="admin-account-card ${ativo ? '' : 'is-disabled'}">
        <div class="admin-account-avatar" aria-hidden="true">${esc(initials)}</div>
        <div class="admin-account-main">
          <div class="admin-account-title">
            <strong class="admin-account-name" title="${esc(u.nome) || '—'}">${esc(u.nome) || '—'}</strong>
            <div class="admin-account-pills">
              <span class="admin-pill ${u.role === 'admin' || u.role === 'diretoria' ? 'admin-pill-admin' : 'admin-pill-user'}">${esc(role)}</span>
              <span class="admin-pill ${ativo ? 'admin-pill-ok' : 'admin-pill-off'}">${ativo ? 'Ativa' : 'Desativada'}</span>
            </div>
          </div>
          <div class="admin-account-meta" title="${esc(u.email) || ''}">${esc(u.email) || '—'}</div>
          <div class="admin-account-date">Atualizado: ${formatQuando(u.atualizadoEm)}</div>
          ${roleEditor}
        </div>
        <div class="admin-account-actions">
          ${isSelf ? '<span class="admin-self-tag">Sua conta</span>' : (canManage ? `
            <button type="button" class="btn btn-sm ${ativo ? 'btn-outline-danger' : 'btn-outline'}" data-toggle-ativo="${u.id}" data-ativo="${ativo ? '1' : '0'}">
              ${ativo ? 'Desativar' : 'Reativar'}
            </button>` : '')}
        </div>
      </article>`;
  }).join('')}</div>`;
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
    return `<tr class="${novo ? 'admin-access-new' : ''}">
      <td class="col-when"><span class="cell-clip">${formatQuando(a.criadoEm)}</span></td>
      <td class="col-name">
        <div class="admin-access-name">
          <span class="cell-clip" title="${esc(a.nome) || '—'}">${esc(a.nome) || '—'}</span>
          ${novo ? '<span class="admin-pill admin-pill-warn">Novo</span>' : ''}
        </div>
      </td>
      <td class="col-email"><span class="cell-clip" title="${esc(a.email) || ''}">${esc(a.email) || '—'}</span></td>
      <td class="col-device"><span class="cell-clip" title="${esc(a.userAgent || '')}">${esc(deviceLabel(a.userAgent))}</span></td>
    </tr>`;
  }).join('');
}

export function renderAdministracao(user, params = []) {
  const activeTab = resolveAdminTab(params);
  const coordenacoes = getCollection('coordenacoes');
  const municipios = getCollection('municipios');
  const regionais = getCollection('regionais');
  const anexosCount = getAnexos().length;
  const usersCount = getUsers().length;
  const acessosCount = getAcessos().length;

  return `
    <div class="page-header"><h2>Administração</h2></div>
    <p class="text-muted mb-3">Gerencie coordenações (e o vínculo com GAS, GVS ou GAP), municípios, regionais, anexos, contas e acessos.</p>
    <div class="tabs" id="admin-tabs">
      <button class="tab ${activeTab === 'coords' ? 'active' : ''}" data-tab="coords">Coordenações</button>
      <button class="tab ${activeTab === 'muns' ? 'active' : ''}" data-tab="muns">Municípios (${municipios.length})</button>
      <button class="tab ${activeTab === 'regs' ? 'active' : ''}" data-tab="regs">Regionais (${regionais.length})</button>
      <button class="tab ${activeTab === 'anexos' ? 'active' : ''}" data-tab="anexos">Anexos (${anexosCount})</button>
      <button class="tab ${activeTab === 'contas' ? 'active' : ''}" data-tab="contas">Contas (${usersCount})</button>
      <button class="tab ${activeTab === 'admins' ? 'active' : ''}" data-tab="admins">Administradores</button>
    </div>
    <div class="tab-content ${activeTab === 'coords' ? 'active' : ''}" data-tab-content="coords">
      <div class="page-header" style="margin-top:12px">
        <p class="text-sm text-muted" style="margin:0">Cada coordenação deve estar vinculada a GAS, GVS ou GAP — isso define para qual Gerência a programação é enviada.</p>
        ${isAdmin(user) ? '<button class="btn btn-primary btn-sm" id="btn-add-coord">+ Nova coordenação</button>' : ''}
      </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Nome</th><th>Sigla</th><th>Gerência</th><th>Ações</th></tr></thead>
        <tbody>${coordenacoes.map((c) => `
          <tr><td>${esc(c.nome)}</td><td>${esc(c.sigla)}</td>
          <td><span class="gerencia-tag gerencia-${String(c.gerencia || '').toLowerCase()}">${esc(c.gerencia)}</span></td>
          <td>${isAdmin(user) ? `<button class="btn-icon" data-edit-coord="${c.id}">✏</button>
          <button class="btn-icon danger" data-del-coord="${c.id}">🗑</button>` : '—'}</td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="tab-content ${activeTab === 'muns' ? 'active' : ''}" data-tab-content="muns">
      <div class="page-header" style="margin-top:12px">
        <span></span>
        ${isAdmin(user) ? '<button class="btn btn-primary btn-sm" id="btn-add-mun">+ Novo município</button>' : ''}
      </div>
      <div class="table-wrapper" style="max-height:400px;overflow:auto"><table>
        <thead><tr><th>Município</th><th>Regional</th><th>Ações</th></tr></thead>
        <tbody>${municipios.map((m) => {
          const reg = regionais.find((r) => r.id === m.regionalId);
          return `<tr><td>${esc(m.nome)}</td><td>${esc(reg?.nome) || '—'}</td>
            <td>${isAdmin(user) ? `<button class="btn-icon" data-edit-mun="${m.id}">✏</button>
            <button class="btn-icon danger" data-del-mun="${m.id}">🗑</button>` : '—'}</td></tr>`;
        }).join('')}</tbody></table></div>
    </div>
    <div class="tab-content ${activeTab === 'regs' ? 'active' : ''}" data-tab-content="regs">
      <div class="page-header" style="margin-top:12px">
        <span></span>
        ${isAdmin(user) ? '<button class="btn btn-primary btn-sm" id="btn-add-reg">+ Nova regional</button>' : ''}
      </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Regional de Saúde</th><th>Municípios</th><th>Ações</th></tr></thead>
        <tbody>${regionais.map((r) => `
          <tr><td>${esc(r.nome)}</td><td>${municipios.filter((m) => m.regionalId === r.id).length}</td>
          <td>${isAdmin(user) ? `<button class="btn-icon" data-edit-reg="${r.id}">✏</button>
          <button class="btn-icon danger" data-del-reg="${r.id}">🗑</button>` : '—'}</td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="tab-content ${activeTab === 'anexos' ? 'active' : ''}" data-tab-content="anexos">
      <div class="card" style="margin-top:12px"><div class="card-body">
        <h3>Anexos de programações</h3>
        <p class="text-sm text-muted mb-3">Documentos enviados pelos usuários. O administrador pode abrir ou excluir qualquer anexo.</p>
        <div class="table-wrapper" style="max-height:480px;overflow:auto">
          <table id="tabela-anexos">
            <thead><tr>
              <th>Enviado em</th><th>Programação</th><th>Coordenação</th><th>Arquivo</th><th>Enviado por</th><th></th>
            </tr></thead>
            <tbody>${renderAnexosRows(user)}</tbody>
          </table>
        </div>
      </div></div>
    </div>
    <div class="tab-content ${activeTab === 'contas' ? 'active' : ''}" data-tab-content="contas">
      <div class="admin-panel mt-2">
        <div class="admin-panel-head">
          <div>
            <h3>Contas cadastradas</h3>
            <p>Quem pode entrar no sistema. O administrador define o perfil: Coordenação, Gerência (GAS/GVS/GAP), Diretoria ou Administrador.</p>
          </div>
          <span class="admin-count">${usersCount}</span>
        </div>
        <div id="lista-contas">${renderContasRows(user)}</div>
      </div>

      <div class="admin-panel mt-3">
        <div class="admin-panel-head">
          <div>
            <h3>Acessos recentes</h3>
            <p>Últimos logins. Badge <strong>Novo</strong> marca e-mail com pouco histórico.</p>
          </div>
          <span class="admin-count">${acessosCount}</span>
        </div>
        <div class="table-wrapper admin-access-wrap">
          <table id="tabela-acessos" class="admin-access-table">
            <thead>
              <tr>
                <th class="col-when">Quando</th>
                <th class="col-name">Nome</th>
                <th class="col-email">E-mail</th>
                <th class="col-device">Dispositivo</th>
              </tr>
            </thead>
            <tbody>${renderAcessosRows()}</tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="tab-content ${activeTab === 'admins' ? 'active' : ''}" data-tab-content="admins">
      <div class="card" style="margin-top:12px"><div class="card-body">
        <h3>Adicionar administrador</h3>
        ${isAdmin(user) ? `
        <p class="text-sm text-muted mb-2">Informe o e-mail de um usuário que já tenha criado conta no sistema.</p>
        <div class="form-row" style="align-items:flex-end">
          <div class="form-group flex-2">
            <label>E-mail do usuário</label>
            <input type="email" class="form-control" id="promote-admin-email" placeholder="usuario@email.com" />
          </div>
          <button class="btn btn-primary" id="btn-promote-admin">Promover a administrador</button>
        </div>` : '<p class="text-sm text-muted mb-0">Somente o Administrador pode promover contas.</p>'}
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
  goAdminTab('coords');
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
  goAdminTab('muns');
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
  goAdminTab('regs');
}

export function bindAdministracao(user, params = []) {
  initUsersAdminSync();

  const refreshAnexosTable = () => {
    const tbody = document.querySelector('#tabela-anexos tbody');
    if (tbody) tbody.innerHTML = renderAnexosRows(user);
    const tab = document.querySelector('#admin-tabs [data-tab="anexos"]');
    if (tab) tab.textContent = `Anexos (${getAnexos().length})`;
  };

  const refreshContasTables = () => {
    const lista = document.getElementById('lista-contas');
    if (lista) lista.innerHTML = renderContasRows(user);
    const acessosBody = document.querySelector('#tabela-acessos tbody');
    if (acessosBody) acessosBody.innerHTML = renderAcessosRows();
    const tab = document.querySelector('#admin-tabs [data-tab="contas"]');
    if (tab) tab.textContent = `Contas (${getUsers().length})`;
    document.querySelectorAll('[data-tab-content="contas"] .admin-count').forEach((el, i) => {
      el.textContent = i === 0 ? String(getUsers().length) : String(getAcessos().length);
    });
  };

  if (resolveAdminTab(params) === 'anexos') refreshAnexosTable();
  if (resolveAdminTab(params) === 'contas') refreshContasTables();

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
      goAdminTab(tab.dataset.tab);
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
    if ((await confirmDialog('Excluir coordenação?')) === 'confirm') { await removeCoordenacao(b.dataset.delCoord); toast('Excluída.', 'success'); goAdminTab('coords'); }
  }));
  document.querySelectorAll('[data-del-mun]').forEach((b) => b.addEventListener('click', async () => {
    if ((await confirmDialog('Excluir município?')) === 'confirm') { await removeMunicipio(b.dataset.delMun); toast('Excluído.', 'success'); goAdminTab('muns'); }
  }));
  document.querySelectorAll('[data-del-reg]').forEach((b) => b.addEventListener('click', async () => {
    if ((await confirmDialog('Excluir regional?')) === 'confirm') { await removeRegional(b.dataset.delReg); toast('Excluída.', 'success'); goAdminTab('regs'); }
  }));

  document.querySelector('[data-tab-content="contas"]')?.addEventListener('change', async (e) => {
    const roleSel = e.target.closest('[data-set-role]');
    const gerSel = e.target.closest('[data-set-gerencia]');
    if (!roleSel && !gerSel) return;
    if (!canManageUsers(user)) return;
    const uid = (roleSel || gerSel).dataset.setRole || (roleSel || gerSel).dataset.setGerencia;
    const card = e.target.closest('.admin-account-card');
    const role = card?.querySelector('[data-set-role]')?.value || 'usuario';
    const gerencia = card?.querySelector('[data-set-gerencia]')?.value || '';
    const gerSelect = card?.querySelector('[data-set-gerencia]');
    if (gerSelect) gerSelect.classList.toggle('hidden', role !== 'gerencia');
    if (role === 'gerencia' && !gerencia) return;
    try {
      await setUserAccess(uid, { role, gerencia });
      toast('Perfil atualizado.', 'success');
      refreshContasTables();
    } catch (err) {
      toast(err.message || 'Erro ao atualizar perfil.', 'error');
    }
  });

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
    if (document.getElementById('lista-contas')) refreshContasTables();
  });
  subscribeAcessos(() => {
    if (document.querySelector('#tabela-acessos')) refreshContasTables();
  });

  document.getElementById('tabela-anexos')?.closest('.tab-content')?.addEventListener('click', async (e) => {
    const openBtn = e.target.closest('[data-open-anexo]');
    if (openBtn) {
      const anexo = getAnexos().find((a) => a.id === openBtn.dataset.openAnexo);
      if (!anexo) { toast('Anexo não encontrado.', 'error'); return; }
      openBtn.disabled = true;
      openBtn.textContent = 'Abrindo...';
      try {
        await openAnexo(anexo);
      } catch (err) {
        toast(err.message || 'Erro ao abrir anexo.', 'error');
      } finally {
        openBtn.disabled = false;
        openBtn.textContent = 'Abrir';
      }
      return;
    }

    const delBtn = e.target.closest('[data-del-anexo]');
    if (!delBtn) return;
    if (!isAdmin(user)) { toast('Somente o administrador pode excluir anexos.', 'error'); return; }
    const anexo = getAnexos().find((a) => a.id === delBtn.dataset.delAnexo);
    if (!anexo) { toast('Anexo não encontrado.', 'error'); return; }
    if ((await confirmDialog(`Excluir o anexo "${anexo.nomeArquivo || 'arquivo'}"?`)) !== 'confirm') return;
    delBtn.disabled = true;
    try {
      await deleteAnexo(anexo.id);
      toast('Anexo excluído.', 'success');
      refreshAnexosTable();
    } catch (err) {
      toast(err.message || 'Erro ao excluir anexo.', 'error');
      delBtn.disabled = false;
    }
  });

  return refreshAnexosTable;
}
