# Deploy Orange na Hostinger

O monorepo tem duas aplicações Node independentes em `frontend/` e `backend/`. A Hostinger publica cada pasta como um website Node separado; portanto, o frontend e a API precisam de dois websites/apps no painel.

## Banco de produção

O plano Unlimited é Web Hosting gerenciado: use o MariaDB/MySQL incluído no hPanel. O schema do Prisma está configurado com o conector `mysql`, compatível com MariaDB.

No hPanel, abra **Websites → Manage site → Databases → Management**, crie um banco e usuário e guarde o nome completo, usuário completo e senha. Configure `DATABASE_URL` no app da API com o formato:

```text
mysql://USUARIO:SENHA@127.0.0.1:3306/BANCO
```

Use os nomes com prefixo exibidos no hPanel. Codifique caracteres especiais da senha em formato URL. A Hostinger exige `127.0.0.1` (não `localhost`) para conexão local de Node.js.

## 1. Publique a API

No deploy Node.js via GitHub, selecione a pasta `backend`.

```text
Node.js: 24.x
Build: npm ci --include=dev && npm run build
Output directory: dist
Entry file: start.js
```

Ao enviar a API por diretório local, gere o build antes de empacotar e inclua `backend/dist/start.js` no material enviado. O validador do Hostinger exige que o arquivo de entrada já exista no pacote; a build do servidor o recompila. Se estiver usando Git, inclua o artefato `dist` ou ajuste a publicação para enviar esse arquivo.

Configure as variáveis no painel da Hostinger antes do deploy:

```text
NODE_ENV=production
FRONTEND_URL=https://SEU-DOMINIO
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=caixa-de-email-do-dominio
SMTP_PASSWORD=senha-da-caixa-de-email
SMTP_FROM=Orange <caixa-de-email-do-dominio>
MFA_ENCRYPTION_KEY=chave-estavel-de-32-bytes-em-hex-ou-base64
GOOGLE_CLIENT_ID=client-id-do-google
GOOGLE_CLIENT_SECRET=client-secret-do-google
APPLE_CLIENT_ID=service-id-da-apple
APPLE_TEAM_ID=team-id-da-apple
APPLE_KEY_ID=key-id-da-apple
APPLE_PRIVATE_KEY=conteudo-da-chave-p8-com-quebras-como-\n
DATABASE_URL=mysql://USUARIO:SENHA@127.0.0.1:3306/BANCO
SEED_ADMIN_USERS='[{"email":"EMAIL-ADMIN","password":"SENHA-UNICA-DE-16-OU-MAIS-CARACTERES"}]'
TRUST_PROXY_HOPS=1
```

Na primeira inicialização, `start:prod` aplica a migração e cria um administrador para cada item de `SEED_ADMIN_USERS`. Guarde o JSON no cofre de variáveis da Hostinger; não coloque credenciais em arquivos rastreados pelo Git. O seed não altera a senha de uma conta que já existe. As variáveis antigas `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` continuam aceitas para uma única conta.

`MFA_ENCRYPTION_KEY` pode ser uma chave estável de 32 bytes em hexadecimal ou Base64. Se não for definida, a API deriva a chave de `DATABASE_URL`; mantenha a URL estável enquanto houver contas com MFA ativado. As variáveis SMTP são necessárias para o envio efetivo dos links de recuperação.

Para habilitar o Google, crie credenciais OAuth Web e cadastre `https://SEU-DOMINIO/api/auth/oauth/google/callback` como URI de redirecionamento autorizado. Para a Apple, configure um Service ID e cadastre `https://SEU-DOMINIO/api/auth/oauth/apple/callback` como Return URL. Use o domínio do frontend nos dois provedores; os caminhos `/api/*` são encaminhados pela aplicação Next para a API. A Apple recebe a chave `.p8` em `APPLE_PRIVATE_KEY`, com cada quebra de linha escrita como `\n`; a API gera o client secret assinado quando troca o código. Se as credenciais de um provedor estiverem ausentes, o botão correspondente fica oculto.

## 2. Publique o frontend

Crie outro website Node.js para o mesmo repositório e selecione a pasta `frontend` como diretório da aplicação.

```text
Node.js: 24.x
Build: npm ci --include=dev && npm run build
Start: npm run start
```

Defina `BACKEND_URL=https://URL-PUBLICA-DA-API` antes do build do frontend. O Next encaminha `/api/*` para a API sob o mesmo domínio do site, mantendo o cookie de sessão no domínio do frontend. Ao publicar por diretório local, envie `frontend/`; ao publicar via Git, configure `frontend` como raiz da aplicação. Depois de publicar ambos, configure `FRONTEND_URL` na API com a origem exata do site e reinicie/republique os serviços conforme necessário.

## 3. Acesse o painel

Abra `/login` no domínio do frontend e use o e-mail e a senha de qualquer item de `SEED_ADMIN_USERS`. A rota `/admin` e as rotas CRUD de planos exigem uma sessão válida.

Faturamento, equipamentos, atendimento, clientes, pagamentos e integrações ainda não estão conectados a sistemas operacionais.
