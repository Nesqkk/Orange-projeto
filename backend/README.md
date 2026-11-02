# Orange API

API NestJS que autentica a equipe administrativa e persiste sessões e planos em MariaDB/MySQL usando Prisma.

## Desenvolvimento local

Clientes podem criar contas em `/cadastro`, entrar em `/login` e acompanhar chamados em `/central-de-operacoes`. A equipe administra chamados pela aba Atendimento do painel. O login aceita MFA TOTP com apps autenticadores e códigos de recuperação de uso único.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` para enviar links de recuperação de senha. O endpoint responde de forma genérica para não revelar quais e-mails estão cadastrados; sem SMTP, o envio não acontece. `MFA_ENCRYPTION_KEY` pode receber uma chave estável de 32 bytes em hexadecimal ou Base64. Se omitida, a chave é derivada de `DATABASE_URL`, que deve permanecer estável enquanto houver MFA ativado.

O login social é opcional. Para ativar o Google, configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Para a Apple, configure `APPLE_CLIENT_ID` (Service ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY` (conteúdo da chave `.p8`, com quebras de linha como `\n`). Cadastre no provedor o callback `https://SEU-DOMINIO/api/auth/oauth/google/callback` ou `https://SEU-DOMINIO/api/auth/oauth/apple/callback`, conforme o provedor. O domínio deve ser o do frontend e `FRONTEND_URL` deve conter somente a origem, sem caminho. As credenciais ficam apenas no ambiente da API; sem configuração completa, o botão daquele provedor não aparece.

Requisitos: Node.js 24.15+ para compilar o NestJS 12 e MySQL ou MariaDB.

```powershell
npm install
Copy-Item .env.example .env
```

Edite `DATABASE_URL` no `.env`. Para MariaDB local, use `mysql://USUARIO:SENHA@127.0.0.1:3306/BANCO`.

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run start:dev
```

A API fica em `http://localhost:4000/api`. As contas administrativas iniciais são criadas a partir do array JSON `SEED_ADMIN_USERS`, com um objeto `email` e `password` para cada conta. Cada senha deve ter pelo menos 16 caracteres. O seed não troca a senha de uma conta que já existe. `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` continuam aceitas para uma única conta.

## Endpoints

- `POST /api/auth/register` cria uma conta de cliente.
- `GET /api/auth/oauth/providers` informa quais provedores sociais e recuperação por e-mail estão configurados.
- `GET /api/auth/oauth/google` e `GET /api/auth/oauth/apple` iniciam a autenticação federada; os callbacks validam state, nonce, assinatura, emissor e audiência do token no servidor.
- `POST /api/auth/password/forgot` e `POST /api/auth/password/reset` enviam link e trocam a senha com token de uso único válido por 30 minutos.
- `POST /api/auth/mfa/setup`, `/enable`, `/disable` e `/api/auth/mfa/verify-login` configuram MFA e validam o segundo fator.
- `POST /api/support/tickets` e `GET /api/support/tickets` criam e acompanham solicitações do cliente autenticado.
- `GET /api/admin/operations/tickets` lista a fila para administradores; resposta e alteração de status também exigem perfil administrativo.

- `POST /api/auth/login` — valida e-mail e senha e cria uma sessão em cookie `HttpOnly`, `SameSite=Lax`; o token em texto puro nunca é armazenado no banco.
- `GET /api/auth/me` — retorna a identidade da sessão autenticada.
- `POST /api/auth/logout` — revoga a sessão e limpa o cookie.
- `GET /api/admin/plans` — lista planos (autenticado).
- `POST /api/admin/plans` — cria plano (autenticado).
- `PATCH /api/admin/plans/:id` — atualiza plano (autenticado).
- `DELETE /api/admin/plans/:id` — remove plano (autenticado).

As tentativas de login têm limite de 5 por minuto por endereço IP. O armazenamento padrão desse limite é em memória; ao escalar para várias instâncias, configure um armazenamento Redis ou limite equivalente no proxy.

## Produção

Para recuperação de senha por e-mail, defina `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` no ambiente de produção. A conta SMTP deve poder enviar pela origem configurada.

Para login federado em produção, cadastre `https://SEU-DOMINIO/api/auth/oauth/google/callback` como URI de redirecionamento autorizado no Google e `https://SEU-DOMINIO/api/auth/oauth/apple/callback` como Return URL do Service ID da Apple. Defina as respectivas credenciais `GOOGLE_*` e `APPLE_*` no ambiente da API. A sessão continua sendo emitida pela API e, se a conta tiver MFA ativado, o callback cria somente o desafio temporário; a sessão só é emitida depois da validação do código MFA.

Configure no serviço da API:

- `NODE_ENV=production`
- `PORT` fornecida pelo host
- `FRONTEND_URL` com a origem HTTPS do frontend
- `DATABASE_URL` com o prefixo `mysql://` para a aplicação e o Prisma Migrate
- `SEED_ADMIN_USERS` guardada como secret no host, contendo o array JSON das contas iniciais
- `TRUST_PROXY_HOPS=1` quando houver um proxy reverso confiável

Comandos de deploy:

```text
Build: npm ci --include=dev && npm run build
Start: npm run start:prod
```

`start:prod` aplica as migrações pendentes, cria o administrador inicial se ainda não existir e inicia a API. Execute apenas uma instância durante a aplicação de migrações.

Na Hostinger Web/Cloud, crie o banco MariaDB/MySQL no hPanel e use `127.0.0.1` como host. O projeto usa o conector `mysql` do Prisma, compatível com MySQL/MariaDB. A hospedagem Node.js gerenciada publica a API e o Next.js como duas aplicações do monorepo; o frontend usa `BACKEND_URL` no build para encaminhar `/api/*` pelo mesmo domínio e preservar os cookies seguros.

As telas de faturamento, máquinas, atendimento, clientes, integrações e pagamentos ainda são protótipos sem persistência ou conexão operacional. Não representam funções habilitadas por esta API.
