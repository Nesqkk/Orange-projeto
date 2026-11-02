# Orange 🍊

Monorepo com duas aplicações independentes: o site Next.js em `frontend/` e a API NestJS em `backend/`. O banco MariaDB/MySQL é acessado pela API via Prisma.

## Pastas

```text
frontend/                 Site, páginas, componentes, estilos e arquivos públicos
  src/app/                Rotas e páginas Next.js
  src/components/         Componentes visuais e formulários
  src/lib/                Hooks e utilitários do frontend
  src/styles/             Estilos do site e do painel
  public/                 Imagens e modelos 3D públicos
backend/                  API, autenticação, clientes, suporte e planos
  src/database/           Conexão Prisma/MariaDB e seed administrativo
  prisma/                 Schema e migrações do banco
package.json              Comandos de conveniência para as duas aplicações
```

O banco fica junto do backend porque a API é responsável por acessar os dados. `backend/prisma/schema.prisma` descreve as tabelas, `backend/prisma/migrations/` versiona mudanças de estrutura, e `backend/src/database/` configura a conexão e o seed. Senhas e URLs do banco ficam em `backend/.env`, que não deve ser publicado.

## Desenvolvimento local

Instale as dependências do frontend:

```powershell
npm --prefix frontend install
```

Configure e inicie o backend em outro terminal:

```powershell
Copy-Item backend/.env.example backend/.env
npm --prefix backend install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run api:dev
```

Inicie o frontend com `npm run dev` na raiz e abra `http://localhost:3000`. O frontend encaminha `/api/*` para a API em `http://localhost:4000` durante o desenvolvimento.

## Comandos na raiz

| Comando | Ação |
| --- | --- |
| `npm run dev` | Inicia o frontend |
| `npm run build` | Compila o frontend |
| `npm run api:dev` | Inicia a API em modo de desenvolvimento |
| `npm run api:build` | Compila a API |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run db:seed` | Cria os administradores configurados |

Consulte [frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md) e [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md) para os detalhes de cada parte e da publicação.

Os preços e depoimentos da landing page são demonstrativos. Recursos operacionais dependem da API e da conexão com o banco.
