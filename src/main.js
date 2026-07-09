import { watchAuth, logoutUser, loginWithEmail, registerAccount, resetPassword, getAuthErrorMessage } from './services/auth.js';
import {
  initProgramacoesSync, subscribeProgramacoes, subscribeLogistica,
  upsertUserProfile, subscribeUserRole, importProgramacoesSeed,
} from './services/programacoes-service.js';
import { setUserRole } from './services/roles.js';
import { renderLogin } from './pages/login.js';
import { renderApp } from './app.js';
import { isFirebaseConfigured } from './firebase/config.js';

const app = document.getElementById('app');
let currentUser = null;
let currentRoute = 'dashboard';
let routeParams = [];
let unsubUserRole = null;

function render() {
  if (!currentUser) {
    app.innerHTML = renderLogin(!isFirebaseConfigured);
    bindLogin();
    return;
  }
  app.innerHTML = renderApp(currentUser, currentRoute, routeParams);
}

function handleHash() {
  const parts = (window.location.hash.slice(1) || 'dashboard').split('/').filter(Boolean);
  currentRoute = parts[0] || 'dashboard';
  routeParams = parts.slice(1);
  if (currentRoute === 'login') currentUser = null;
  render();
}

function bindLogin() {
  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('login-error');
  const titleEl = document.getElementById('auth-title');
  let mode = 'login';

  document.getElementById('toggle-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    titleEl.textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
    document.getElementById('nome-group').classList.toggle('hidden', mode === 'login');
    document.getElementById('auth-submit').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
    document.getElementById('toggle-register').textContent = mode === 'login' ? 'Criar conta' : 'Já tenho conta';
    errorEl.classList.add('hidden');
  });

  document.getElementById('forgot-password')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    if (!email) { errorEl.textContent = 'Informe seu e-mail.'; errorEl.classList.remove('hidden'); return; }
    try {
      await resetPassword(email);
      errorEl.className = 'alert alert-success';
      errorEl.textContent = 'E-mail de recuperação enviado!';
      errorEl.classList.remove('hidden');
    } catch (err) {
      errorEl.className = 'alert alert-error';
      errorEl.textContent = getAuthErrorMessage(err.code);
      errorEl.classList.remove('hidden');
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      errorEl.className = 'alert alert-error';
      errorEl.textContent = 'Configure o Firebase no arquivo .env antes de usar o sistema.';
      errorEl.classList.remove('hidden');
      return;
    }
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const nome = document.getElementById('nome')?.value.trim();
    try {
      if (mode === 'register') {
        const user = await registerAccount({ email, password, nome });
        await upsertUserProfile(user);
      } else {
        await loginWithEmail(email, password);
      }
      window.location.hash = 'dashboard';
    } catch (err) {
      errorEl.className = 'alert alert-error';
      errorEl.textContent = getAuthErrorMessage(err.code) || err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

watchAuth(async (user) => {
  if (unsubUserRole) {
    unsubUserRole();
    unsubUserRole = null;
  }

  if (user && isFirebaseConfigured) {
    try {
      initProgramacoesSync();
      await upsertUserProfile(user);
      unsubUserRole = subscribeUserRole(user.uid, async (role) => {
        currentUser = { ...user, role };
        if (role === 'admin') {
          try {
            await importProgramacoesSeed();
          } catch (err) {
            console.warn('Importação de programações:', err.message);
          }
        }
        handleHash();
      });
    } catch (err) {
      console.error(err);
      currentUser = user;
      render();
    }
  } else {
    setUserRole('usuario');
    currentUser = user;
    render();
  }
});

subscribeProgramacoes(() => { if (currentUser) render(); });
subscribeLogistica(() => { if (currentUser) render(); });

window.addEventListener('hashchange', handleHash);

if (!isFirebaseConfigured) {
  render();
}
