# Orange

<p>
  Experiência digital da Orange para apresentação da marca, cadastro e autenticação de clientes, recuperação de conta, operações da central do cliente e administração.
</p>

## Visão geral

O projeto combina um frontend Next.js exportável como site estático com uma API PHP preparada para hospedagem compartilhada e banco MariaDB.

```text
Navegador
   |
   | HTTPS
   v
Frontend Next.js estático  ->  app.bebaorange.com
   |
   | /api/*
   v
API PHP + CORS/cookies  ->  api-app.bebaorange.com
   |
   v
MariaDB
```

O plano atual não precisa de Node.js em produção: o frontend é compilado na máquina ou em CI e publicado como arquivos estáticos.

---

## Recursos

### Experiência pública

- Página inicial com apresentação da marca e recursos visuais
- Páginas institucionais: Sobre, Contato, Privacidade e Termos
- Design responsivo
- Modelos e elementos 3D
- Conteúdo público compatível com MCP

### Contas

- Cadastro com confirmação por e-mail
- Login com sessão em cookie `HttpOnly`
- Logout e recuperação de sessão
- Recuperação e redefinição de senha
- MFA TOTP com códigos de recuperação
- Login social com Google
- Proteção das áreas administrativas e da central do cliente

### Área do cliente

- Dados da conta
- Operações e acompanhamento
- Chamados e mensagens
- Preferências de comunicação

### Administração

- Visão geral de clientes e contas
- Gerenciamento de clientes
- Chamados e atendimento
- Configurações de MFA
- Comunicação e comunicados

### Integração MCP

O servidor MCP público disponibiliza ferramentas de consulta sobre páginas e informações públicas da Orange.

---

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend ativo | Next.js 15, React 19, TypeScript, Tailwind CSS |
| API atual | PHP 8.3+, PDO MySQL, OpenSSL |
| Banco atual | MariaDB/MySQL |
| Experiência 3D | Three.js e modelos GLB |
| Protocolo público | MCP JSON-RPC |

---

## Estrutura do repositório

```text
orange-site/
├── src/                    # Frontend Next.js ativo na raiz
│   ├── app/                # Páginas e rotas públicas/privadas
│   ├── components/         # Interface, painéis e componentes visuais
│   ├── lib/                # Utilitários e hooks
│   └── styles/             # Estilos do site e da administração
├── public/                 # Imagens, modelos 3D e arquivos públicos
├── backend-php/            # API PHP recomendada para produção
│   ├── src/                # Auth, OAuth, admin, suporte e comunicados
│   ├── migrations/         # Migrações SQL adicionais
│   ├── tests/              # Verificação local da API
│   ├── schema.sql          # Schema inicial do banco
│   ├── index.php           # Roteador principal da API
│   ├── mcp.php             # Endpoint MCP
│   └── config.example.php  # Modelo seguro de configuração
├── frontend/               # Versão alternativa do frontend em Node
├── backend/                # Implementação NestJS legada
├── out/                    # Export estático gerado pelo build
└── DEPLOY-HOSTINGER.md     # Instruções históricas de deploy Node.js
```

### Versão recomendada

Para hospedagem PHP compartilhada atual, use:

- Frontend da raiz: `src/` e `public/`
- API: `backend-php/`
- Banco: MariaDB/MySQL

As pastas `frontend/` e `backend/` são mantidas como referência ou alternativa legada. Não use `backend/` com o plano PHP atual sem revisar a arquitetura e os dados existentes.

---

## Desenvolvimento local

### Requisitos

- Node.js 20 ou superior
- npm
- PHP 8.3 ou superior
- Extensões PHP `PDO_MySQL` e `OpenSSL`
- MariaDB/MySQL local para testar a API completa

### Frontend

Na raiz do projeto:

```powershell
npm ci --include=dev
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

Sem `NEXT_PUBLIC_BACKEND_URL`, o frontend usa `http://localhost:4000` como referência de desenvolvimento.

### Build estático

```powershell
$env:NEXT_PUBLIC_BACKEND_URL = "https://api-app.bebaorange.com"
npm run build
```

Os arquivos publicados serão gerados no diretório `out/`.

### API PHP

```powershell
cd backend-php
php -S localhost:4000
```

Publique a API em uma porta local ou configurada pela hospedagem. Antes de iniciar em produção, configure o banco e o arquivo privado descritos na seção seguinte.

---

## Configuração da API PHP

### Banco de dados

Crie um banco novo e vazio no MariaDB/MySQL antes da primeira instalação.

```sql
SOURCE backend-php/schema.sql;
```

Não execute o schema em banco existente sem revisão, backup e autorização. A API não substitui nem atualiza dados antigos automaticamente.

### Configuração privada

O PHP não lê automaticamente arquivos `.env`. Copie o modelo:

```text
backend-php/config.example.php
```

Para:

```text
orange-config.php
```

O arquivo deve ficar fora de `public_html`, em um diretório privado acima da pasta pública da API.

Exemplo das principais opções:

```php
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nome_do_banco
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco

FRONTEND_URL=https://app.bebaorange.com
COOKIE_DOMAIN=.bebaorange.com
API_URL=https://api-app.bebaorange.com

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=conta@seu-dominio.com
SMTP_PASSWORD=senha-da-conta
SMTP_FROM=Orange <conta@seu-dominio.com>

MFA_ENCRYPTION_KEY=chave-estavel-de-32-bytes
TRUST_PROXY_HOPS=1
NODE_ENV=production
```

Nunca confirme:

- Senhas de banco
- Senhas de e-mail
- Chaves MFA
- Credenciais OAuth
- Tokens ou arquivos de configuração privados

### Administrador inicial

Defina `SEED_ADMIN_USERS` no arquivo privado usando JSON:

```json
[{"email":"admin@seu-dominio.com","password":"SENHA-UNICA-DE-16-OU-MAIS-CARACTERES"}]
```

Em seguida:

```powershell
php backend-php/seed-admin.php
```

O seed não altera senhas de contas existentes. Após criar o administrador, remova as credenciais do arquivo privado.

---

## Autenticação

### E-mail e senha

- Senhas são armazenadas com `password_hash`
- Sessões usam cookie `HttpOnly`
- Links de confirmação expiram em 24 horas
- Links de redefinição expiram em 30 minutos
- Tentativas são limitadas no banco
- Respostas evitam revelar se um e-mail está cadastrado

### MFA

O projeto suporta TOTP e códigos de recuperação de uso único.

`MFA_ENCRYPTION_KEY` deve ser uma chave estável em hexadecimal ou Base64 com 32 bytes. Não troque essa chave enquanto houver contas com MFA ativo, pois os segredos existentes não poderão ser descriptografados.

### Google

Login com Google pode ser habilitado no Google Cloud Console.

Configure no provedor:

```text
Origem JavaScript autorizada:
https://app.bebaorange.com

URI de redirecionamento:
https://api-app.bebaorange.com/api/auth/oauth/google/callback
```

Preencha no arquivo privado:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

O fluxo utiliza state, nonce e PKCE. Contas administrativas não entram pelo Google.

---

## Endpoints da API PHP

| Método | Endpoint | Função |
|---|---|---|
| `GET` | `/api/health` | Saúde da API e conexão com o banco |
| `POST` | `/api/auth/register` | Cadastro |
| `POST` | `/api/auth/email/verify` | Confirmação de e-mail |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/me` | Dados da sessão |
| `POST` | `/api/auth/logout` | Encerramento da sessão |
| `POST` | `/api/auth/password/forgot` | Solicitação de redefinição |
| `POST` | `/api/auth/password/reset` | Redefinição de senha |
| `POST` | `/api/auth/mfa/*` | Configuração e validação MFA |
| `GET` | `/api/auth/oauth/providers` | Provedores sociais habilitados |
| `GET` | `/api/support/tickets` | Chamados do cliente |
| `POST` | `/api/support/tickets` | Criação de chamado |
| `GET` | `/api/admin/overview` | Visão geral administrativa |
| `GET` | `/api/admin/customers` | Clientes |
| `GET` | `/api/admin/broadcasts` | Comunicados |

Os endpoints administrativos exigem sessão autenticada com perfil de administrador.

---

## Endpoint MCP

O endpoint público fica disponível em:

```text
https://api-app.bebaorange.com/mcp
```

Ferramentas disponíveis:

- `orange_site_overview` — resumo público do projeto
- `orange_find_public_page` — busca páginas públicas por tema
- `orange_support_contact` — fornece contato e página de suporte

O MCP atual expõe somente informações públicas e não concede acesso administrativo.

---

## Build e deploy

### Frontend estático

1. Execute o build do frontend.
2. Publique todo o conteúdo de `out/` no domínio público.
3. Configure `NEXT_PUBLIC_BACKEND_URL` com a origem da API.
4. Valide HTTPS, redirecionamento e arquivos públicos.

### API PHP

1. Publique `backend-php/` no subdomínio da API.
2. Importe o schema em banco novo e vazio.
3. Instale `orange-config.php` fora de `public_html`.
4. Execute o seed administrativo uma única vez.
5. Valide `https://api-app.bebaorange.com/api/health`.
6. Remova as credenciais temporárias do seed.

Domínios de referência:

```text
Frontend: https://app.bebaorange.com
API:      https://api-app.bebaorange.com
```

Consulte [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md) para o fluxo legado baseado em Node.js. Consulte [backend-php/README.md](backend-php/README.md) para os detalhes da API PHP.

---

## Verificação local

### Frontend

```powershell
npm run lint
npm run build
```

### API PHP

```powershell
php backend-php/tests/self-test.php
Get-ChildItem backend-php -Filter *.php -Recurse |
  ForEach-Object { php -l $_.FullName }
```

Use `php -S` para testar a API localmente e acompanhe os logs do servidor PHP.

---

## Migração de contas antigas

As contas criadas pelo backend NestJS anterior podem usar hashes `scrypt`. O backend PHP atual não precisa aceitar esses formatos como login por senha.

Antes de migrar usuários reais:

1. Faça backup completo do banco.
2. Confirme propriedade e dados das contas.
3. Ative recuperação de senha por e-mail.
4. Solicite redefinição das senhas antigas.
5. Valide o processo em ambiente de homologação.

Não execute migração em dados de produção sem backup verificado e aprovação.

---

## Segurança

- Configure TLS/HTTPS em frontend e API
- Restrinja CORS à origem real do frontend
- Use cookies seguros em produção
- Não armazene segredos no repositório
- Não altere usuários, bancos ou schema de produção sem backup
- Mantenha `MFA_ENCRYPTION_KEY` estável
- Revise permissões de arquivos no servidor
- Remova arquivos temporários e credenciais após o seed

---

## Limitações conhecidas

- Faturamento, máquinas e integrações externas podem estar representados apenas por protótipos visuais
- Apple permanece desabilitado no backend PHP atual
- Contas antigas precisam redefinir a senha antes do login no PHP
- `backend/` não é o backend recomendado do plano compartilhado
- Alguns arquivos de `frontend/` podem representar uma versão anterior da interface

---

## Licença

Consulte o proprietário do projeto antes de redistribuir ou usar comercialmente este código.
