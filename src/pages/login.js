export function renderLogin() {
  return `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logos">
          <img src="/assets/logo-sesapi.svg" alt="Logo SESAPI" />
          <img src="/assets/logo-duvas.svg" alt="Logo DUVAS" />
        </div>
        <div class="login-title">
          <h1>Sistema Integrado de Gestão de Programações da Vigilância em Saúde</h1>
          <p>SIGP-VS — DUVAS / SESAPI</p>
        </div>
        <div id="login-error" class="alert alert-error hidden"></div>
        <form id="login-form">
          <div class="form-group">
            <label for="cpf">CPF</label>
            <input type="text" id="cpf" class="form-control" placeholder="000.000.000-00" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="senha">Senha</label>
            <input type="password" id="senha" class="form-control" placeholder="Digite sua senha" required autocomplete="current-password" />
          </div>
          <div class="login-actions">
            <button type="submit" class="btn btn-primary btn-lg btn-block">Entrar</button>
          </div>
        </form>
        <a href="#" id="forgot-password" class="login-forgot">Esqueci minha senha</a>
        <div class="alert alert-info mt-3" style="font-size:0.75rem">
          <strong>Acesso demo:</strong><br>
          Admin: CPF 000.000.000-00 / admin123<br>
          Gerência: CPF 123.456.789-01 / gerencia1<br>
          Consulta: CPF 111.222.333-44 / consulta1
        </div>
      </div>
    </div>
  `;
}
