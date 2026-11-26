# API PHP da Orange

API para o plano compartilhado Hostinger, sem runtime Node.js. Requer PHP 8.3+ com `PDO MySQL` e OpenSSL, além de uma base MariaDB compatível com `schema.sql`.

## Instalação no servidor

1. Crie um banco novo e vazio no hPanel; não use os bancos existentes do Orange sem autorização, revisão dos dados e backup verificado.
2. Importe `schema.sql` nesse banco vazio. A API não cria nem altera tabelas automaticamente.
3. Publique o conteúdo de `backend-php/` como website PHP em `api-app.bebaorange.com`.
4. Copie `config.example.php` para `orange-config.php` no diretório acima de `public_html` e preencha-o somente no servidor. Nunca coloque o arquivo privado em `public_html` ou no repositório.
5. Execute `php seed-admin.php` uma única vez com `SEED_ADMIN_USERS` no arquivo privado. O comando recusa sobrescrever uma conta existente; remova as credenciais de administrador depois do seed.
6. Valide `https://api-app.bebaorange.com/api/health`; a resposta deve indicar `status: ok` e `database: connected`.

## Endpoints implementados

- Cadastro em uma página, confirmação de e-mail e reenvio do link (validade de 24 horas, resposta sem revelar se a conta existe e intervalo mínimo de 60 segundos), login, logout, sessões HttpOnly e recuperação de senha.
- Após confirmar o e-mail, clientes recebem a mensagem de boas-vindas com a oferta de lançamento, a menos que tenham cancelado comunicados. A confirmação continua sendo um e-mail separado; redefinições expiram em 30 minutos.
- MFA TOTP e códigos de recuperação de uso único.
- Clientes e planos no painel administrativo.
- Chamados e mensagens da central do cliente/equipe.
- Ferramentas MCP públicas, servidas em `https://api-app.bebaorange.com/mcp`.
- CORS com credenciais limitado à origem HTTPS definida por `FRONTEND_URL`.
- Limitação de tentativas armazenada no próprio banco.

As senhas são armazenadas com `password_hash` do PHP. Isso não valida hashes `scrypt$...` do backend NestJS. O login com Apple continua desabilitado.

## Login com Google

1. No Google Cloud Console, crie um projeto, configure a tela de consentimento OAuth (tipo Externo, escopos `openid`, `email`, `profile`) e publique-a.
2. Em Credenciais, crie um ID do cliente OAuth do tipo **Aplicativo da Web**:
   - Origem JavaScript autorizada: `https://app.bebaorange.com`
   - URI de redirecionamento autorizado: `https://api-app.bebaorange.com/api/auth/oauth/google/callback`
3. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `orange-config.php` do servidor (e `API_URL`, se a API mudar de endereço).
4. `GET /api/auth/oauth/providers` passa a responder `google: true` e o botão do site é liberado.

O fluxo usa state, nonce e PKCE. Clientes são vinculados pelo e-mail verificado no Google; se o e-mail pertence a um cadastro nunca confirmado, a senha desse cadastro é descartada. Contas ADMIN não entram com Google. Contas com MFA continuam pedindo o código.

## Verificação local

Com PHP 8.3+ e OpenSSL:

```powershell
php tests/self-test.php
Get-ChildItem -Filter *.php -Recurse | ForEach-Object { php -l $_.FullName }
```
