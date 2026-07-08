import { getAuth, clearAuth, login, initStorage } from './services/storage.js';
import { renderLogin } from './pages/login.js';
import { renderApp } from './app.js';

initStorage();

const app = document.getElementById('app');

function navigate(hash) {
  window.location.hash = hash;
}

function handleRoute() {
  const user = getAuth();
  const hash = window.location.hash.slice(1) || 'dashboard';
  const parts = hash.split('/').filter(Boolean);
  const route = parts[0] || 'dashboard';
  const params = parts.slice(1);

  if (!user && route !== 'login') {
    app.innerHTML = renderLogin();
    bindLogin();
    return;
  }

  if (user && route === 'login') {
    navigate('dashboard');
    return;
  }

  if (route === 'login') {
    app.innerHTML = renderLogin();
    bindLogin();
    return;
  }

  app.innerHTML = renderApp(user, route, params);
}

function bindLogin() {
  const form = document.getElementById('login-form');
  const cpfInput = document.getElementById('cpf');
  const errorEl = document.getElementById('login-error');

  cpfInput?.addEventListener('input', (e) => {
    e.target.value = formatCPFInput(e.target.value);
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const cpf = document.getElementById('cpf').value;
    const senha = document.getElementById('senha').value;
    const user = login(cpf, senha);
    if (user) {
      navigate('dashboard');
    } else {
      errorEl.textContent = 'CPF ou senha inválidos.';
      errorEl.classList.remove('hidden');
    }
  });

  document.getElementById('forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Entre em contato com o administrador do sistema para redefinir sua senha.');
  });
}

function formatCPFInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

window.addEventListener('hashchange', handleRoute);
handleRoute();

export { navigate, clearAuth };
