export function renderLogin(firebaseMissing = false) {
  return `
    <div class="login-page">
      <div class="login-card login-card-wide">
        <div class="login-logos">
          <img src="/assets/logo-sesapi.svg" alt="Logo SESAPI" />
          <img src="/assets/logo-duvas.svg" alt="Logo DUVAS" />
        </div>
        <div class="login-title">
          <h1>Sistema Integrado de Gestão de Programações da Vigilância em Saúde</h1>
          <p>SIGP-VS — DUVAS / SESAPI</p>
        </div>
        ${firebaseMissing ? `
          <div class="alert alert-warning">
            Configure o Firebase: copie <code>.env.example</code> para <code>.env</code> e preencha suas credenciais.
            Modo local ativo até configurar.
          </div>
        ` : ''}
        <div id="login-error" class="alert alert-error hidden"></div>
        <h2 id="auth-title" class="auth-title">Entrar</h2>
        <form id="auth-form">
          <div class="form-group hidden" id="nome-group">
            <label for="nome">Nome completo</label>
            <input type="text" id="nome" class="form-control" placeholder="Seu nome" autocomplete="name" />
          </div>
          <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" class="form-control" placeholder="seu@email.com" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" class="form-control" placeholder="Mínimo 6 caracteres" required autocomplete="current-password" minlength="6" />
          </div>
          <div class="login-actions">
            <button type="submit" class="btn btn-primary btn-lg btn-block" id="auth-submit">Entrar</button>
          </div>
        </form>
        <div class="login-links">
          <a href="#" id="forgot-password">Esqueci minha senha</a>
          <a href="#" id="toggle-register">Criar conta</a>
        </div>
      </div>
    </div>
  `;
}
