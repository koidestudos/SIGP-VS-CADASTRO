import {
  getCollection, addItem, deleteItem, isAdmin, resetData,
} from '../services/storage.js';
import { GERENCIAS, generateId, PERFIS } from '../data/seed.js';
import { confirmDialog, toast, formatCPF } from '../components/ui.js';

export function renderAdministracao(user) {
  if (!isAdmin(user)) {
    return `<div class="alert alert-warning">Acesso restrito a administradores.</div>`;
  }

  const coordenacoes = getCollection('coordenacoes');
  const municipios = getCollection('municipios');
  const regionais = getCollection('regionais');
  const usuarios = getCollection('usuarios');

  return `
    <div class="page-header"><h2>Administração</h2></div>

    <div class="approval-flow mb-3">
      <span class="step">Gerência cadastra</span><span class="arrow">↓</span>
      <span class="step">Revisa informações</span><span class="arrow">↓</span>
      <span class="step">Aprova programação</span><span class="arrow">↓</span>
      <span class="step">Publicada automaticamente</span>
    </div>

    <div class="tabs" id="admin-tabs">
      <button class="tab active" data-tab="coords">Coordenações</button>
      <button class="tab" data-tab="muns">Municípios</button>
      <button class="tab" data-tab="regs">Regionais</button>
      <button class="tab" data-tab="users">Usuários</button>
      <button class="tab" data-tab="perfis">Perfis</button>
      <button class="tab" data-tab="sistema">Sistema</button>
    </div>

    <div class="tab-content active" data-tab-content="coords">
      <div class="admin-section">
        <div class="flex-between mb-2">
          <h3>Coordenações (${coordenacoes.length})</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-coord">➕ Nova</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Sigla</th><th>Gerência</th><th>Ações</th></tr></thead>
            <tbody>
              ${coordenacoes.map((c) => `
                <tr>
                  <td>${c.nome}</td><td>${c.sigla}</td>
                  <td><span class="gerencia-tag gerencia-${c.gerencia.toLowerCase()}">${c.gerencia}</span></td>
                  <td><button class="btn-icon danger" data-del-coord="${c.id}">🗑</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="tab-content" data-tab-content="muns">
      <div class="admin-section">
        <div class="flex-between mb-2">
          <h3>Municípios (${municipios.length})</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-mun">➕ Novo</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Regional</th><th>Coordenação</th><th>Ações</th></tr></thead>
            <tbody>
              ${municipios.map((m) => {
                const reg = regionais.find((r) => r.id === m.regionalId);
                const coord = coordenacoes.find((c) => c.id === m.coordenacaoId);
                return `<tr><td>${m.nome}</td><td>${reg?.nome || '—'}</td><td>${coord?.sigla || '—'}</td>
                  <td><button class="btn-icon danger" data-del-mun="${m.id}">🗑</button></td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="tab-content" data-tab-content="regs">
      <div class="admin-section">
        <div class="flex-between mb-2">
          <h3>Regionais de Saúde (${regionais.length})</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-reg">➕ Nova</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Ações</th></tr></thead>
            <tbody>
              ${regionais.map((r) => `
                <tr><td>${r.nome}</td><td><button class="btn-icon danger" data-del-reg="${r.id}">🗑</button></td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="tab-content" data-tab-content="users">
      <div class="admin-section">
        <div class="flex-between mb-2">
          <h3>Usuários (${usuarios.length})</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-user">➕ Novo</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>CPF</th><th>Perfil</th><th>Ações</th></tr></thead>
            <tbody>
              ${usuarios.map((u) => `
                <tr>
                  <td>${u.nome}</td>
                  <td>${formatCPF(u.cpf)}</td>
                  <td>${u.perfil}</td>
                  <td><button class="btn-icon danger" data-del-user="${u.id}">🗑</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="tab-content" data-tab-content="perfis">
      <div class="admin-section">
        <h3>Perfis de Acesso</h3>
        <div class="grid-3">
          <div class="card"><div class="card-body">
            <h4 style="color:var(--primary)">Administrador</h4>
            <ul class="text-sm mt-2" style="padding-left:18px">
              <li>Gerencia usuários</li><li>Cadastra coordenações</li><li>Cadastra municípios</li><li>Configura o sistema</li>
            </ul>
          </div></div>
          <div class="card"><div class="card-body">
            <h4 style="color:var(--secondary)">Gerência</h4>
            <ul class="text-sm mt-2" style="padding-left:18px">
              <li>Cadastra programações</li><li>Edita programações</li><li>Aprova programações</li>
              <li>Exclui programações</li><li>Emite relatórios</li>
            </ul>
          </div></div>
          <div class="card"><div class="card-body">
            <h4 style="color:var(--gray-600)">Consulta</h4>
            <ul class="text-sm mt-2" style="padding-left:18px">
              <li>Visualiza programações</li><li>Consulta calendário</li><li>Gera relatórios</li>
            </ul>
          </div></div>
        </div>
      </div>
    </div>

    <div class="tab-content" data-tab-content="sistema">
      <div class="admin-section">
        <h3>Configurações do Sistema</h3>
        <p class="text-muted mb-2">Restaurar dados iniciais de demonstração.</p>
        <button class="btn btn-danger btn-sm" id="btn-reset-data">Restaurar dados demo</button>
      </div>
    </div>
  `;
}

export function bindAdministracao(user) {
  if (!isAdmin(user)) return;

  const tabs = document.getElementById('admin-tabs');
  tabs?.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tabs.parentElement.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      tabs.parentElement.querySelector(`[data-tab-content="${tab.dataset.tab}"]`)?.classList.add('active');
    });
  });

  document.getElementById('btn-add-coord')?.addEventListener('click', () => {
    const nome = prompt('Nome da coordenação:');
    const sigla = prompt('Sigla:');
    const gerencia = prompt(`Gerência (${GERENCIAS.join('/')}):`);
    if (nome && sigla && GERENCIAS.includes(gerencia?.toUpperCase())) {
      addItem('coordenacoes', { id: generateId('c'), nome, sigla, gerencia: gerencia.toUpperCase() });
      toast('Coordenação adicionada.', 'success');
      window.location.hash = 'administracao';
    }
  });

  document.getElementById('btn-add-mun')?.addEventListener('click', () => {
    const nome = prompt('Nome do município:');
    if (nome) {
      addItem('municipios', { id: generateId('m'), nome, regionalId: 'r1', coordenacaoId: 'gas-crianca' });
      toast('Município adicionado.', 'success');
      window.location.hash = 'administracao';
    }
  });

  document.getElementById('btn-add-reg')?.addEventListener('click', () => {
    const nome = prompt('Nome da regional:');
    if (nome) {
      addItem('regionais', { id: generateId('r'), nome });
      toast('Regional adicionada.', 'success');
      window.location.hash = 'administracao';
    }
  });

  document.getElementById('btn-add-user')?.addEventListener('click', () => {
    const nome = prompt('Nome:');
    const cpf = prompt('CPF (somente números):');
    const senha = prompt('Senha:');
    const perfil = prompt(`Perfil (${PERFIS.join('/')}):`);
    if (nome && cpf && senha && PERFIS.includes(perfil)) {
      addItem('usuarios', { id: generateId('u'), nome, cpf, senha, perfil, coordenacaoId: null });
      toast('Usuário adicionado.', 'success');
      window.location.hash = 'administracao';
    }
  });

  document.querySelectorAll('[data-del-coord]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if ((await confirmDialog('Excluir coordenação?')) === 'confirm') {
        deleteItem('coordenacoes', btn.dataset.delCoord);
        window.location.hash = 'administracao';
      }
    });
  });

  document.querySelectorAll('[data-del-mun]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if ((await confirmDialog('Excluir município?')) === 'confirm') {
        deleteItem('municipios', btn.dataset.delMun);
        window.location.hash = 'administracao';
      }
    });
  });

  document.querySelectorAll('[data-del-reg]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if ((await confirmDialog('Excluir regional?')) === 'confirm') {
        deleteItem('regionais', btn.dataset.delReg);
        window.location.hash = 'administracao';
      }
    });
  });

  document.querySelectorAll('[data-del-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if ((await confirmDialog('Excluir usuário?')) === 'confirm') {
        deleteItem('usuarios', btn.dataset.delUser);
        window.location.hash = 'administracao';
      }
    });
  });

  document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
    if ((await confirmDialog('Restaurar todos os dados para o estado inicial?')) === 'confirm') {
      resetData();
      toast('Dados restaurados.', 'success');
      window.location.hash = 'administracao';
    }
  });
}
