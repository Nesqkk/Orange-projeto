# Orange

Site Next.js exportado como arquivos estáticos e API PHP para hospedagem compartilhada. A interface mantém as páginas públicas, cadastro, login, área do cliente e painel administrativo; as operações autenticadas passam pela API em `backend-php/`.

## Estrutura

- `src/`: interface Next.js e telas do site/contas.
- `public/`: assets estáticos, `.htaccess`, Markdown e o cartão público do MCP.
- `backend-php/`: API PHP, endpoint MCP, schema MariaDB e configuração de exemplo para hospedagem.
- `backend/`: implementação NestJS anterior, mantida como referência; não publicar no plano atual.

## Desenvolvimento e build do frontend

Node.js é necessário apenas na máquina/CI para compilar o Next.js; o site publicado é estático e não precisa de runtime Node.js:

```powershell
npm ci --include=dev
$env:NEXT_PUBLIC_BACKEND_URL = "https://api-app.bebaorange.com"
npm run build
```

O diretório `out/` contém os arquivos estáticos para o website `app.bebaorange.com`. Em desenvolvimento, sem `NEXT_PUBLIC_BACKEND_URL`, o frontend aponta para `http://localhost:4000`.

## API PHP e banco

Publique `backend-php/` como website PHP no subdomínio `api-app.bebaorange.com`. Importe `backend-php/schema.sql` somente para um banco novo e vazio. Não use os bancos existentes do Orange nem execute DDL em produção sem confirmar os dados e o backup.

O plano compartilhado não oferece variáveis de ambiente para PHP no hPanel. Com sua autorização, a API lê um arquivo privado `orange-config.php` no diretório acima de `public_html`. Copie o modelo `backend-php/config.example.php` para esse local e preencha os segredos apenas no servidor; nunca os coloque no repositório, em `public_html`, logs ou chat.

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `FRONTEND_URL=https://app.bebaorange.com`
- `COOKIE_DOMAIN=.bebaorange.com`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `MFA_ENCRYPTION_KEY` (chave estável de 32 bytes, em hex ou Base64)
- `SEED_ADMIN_USERS` (JSON; use apenas no seed)
- `TRUST_PROXY_HOPS=1`, `NODE_ENV=production`
- `API_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (login com Google)

`orange-hostinger-php.env.example` é apenas uma lista de referência; o PHP não carrega arquivos `.env` automaticamente. O endpoint `GET /api/health` confirma a conexão com o banco sem retornar credenciais.

O administrador inicial é criado manualmente por `php seed-admin.php` depois de importar o schema, usando `SEED_ADMIN_USERS` no arquivo privado. Após o seed, remova as credenciais de administrador desse arquivo. O seed não redefine contas existentes.

## Limitações da conversão

- O website não executa Node.js em produção; PHP trata as rotas da API e MariaDB armazena as contas.
- Login com Google está implementado; fica ativo quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão no arquivo privado (veja `backend-php/README.md`). Apple permanece desativado.
- Contas antigas usam hashes scrypt do backend NestJS e não podem entrar com a senha atual até redefini-la por e-mail após uma migração autorizada. Não migre usuários sem revisar os dados e preparar backup; bancos atuais devem permanecer intocados.
- Nenhum banco, domínio, DNS, caixa postal ou website é criado/publicado por estes arquivos.
