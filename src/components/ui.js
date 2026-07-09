export function showModal({ title, body, footer, size = '' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('.modal-close').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    overlay.querySelectorAll('[data-modal-action]').forEach((btn) => {
      btn.addEventListener('click', () => close(btn.dataset.modalAction));
    });

    document.body.appendChild(overlay);
  });
}

export function confirmDialog(message, title = 'Confirmar') {
  return showModal({
    title,
    body: `<p>${message}</p>`,
    footer: `
      <button class="btn btn-ghost" data-modal-action="cancel">Cancelar</button>
      <button class="btn btn-danger" data-modal-action="confirm">Confirmar</button>
    `,
  });
}

export function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2000;min-width:280px;box-shadow:var(--shadow-md);';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function bindTabs(container) {
  container.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      container.querySelector(`[data-tab-content="${target}"]`)?.classList.add('active');
    });
  });
}

export function renderStatusBadge(status) {
  const cls = {
    Rascunho: 'badge-rascunho',
    Pendente: 'badge-pendente',
    Aprovada: 'badge-aprovado',
    Publicada: 'badge-programada',
    Concluída: 'badge-aprovado',
    Programada: 'badge-programada',
    Aprovado: 'badge-aprovado',
    Cancelada: 'badge-cancelada',
    Solicitado: 'badge-solicitado',
    Confirmado: 'badge-confirmado',
  }[status] || 'badge-rascunho';
  return `<span class="badge ${cls}">${status}</span>`;
}

export function renderActionButtons(id, { view = true, edit = true, del = true, extra = '' } = {}) {
  return `
    <div class="table-actions">
      ${view ? `<button class="btn-icon" title="Visualizar" data-action="view" data-id="${id}">👁</button>` : ''}
      ${edit ? `<button class="btn-icon" title="Editar" data-action="edit" data-id="${id}">✏</button>` : ''}
      ${del ? `<button class="btn-icon danger" title="Excluir" data-action="delete" data-id="${id}">🗑</button>` : ''}
      ${extra}
    </div>
  `;
}
