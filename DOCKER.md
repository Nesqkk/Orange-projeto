# Orange com Docker Compose

Este Compose foi preparado para desenvolvimento local. Ele sobe o frontend Next.js, a API NestJS e um MariaDB com volume persistente. As portas publicadas ficam limitadas a `127.0.0.1`.

## Requisitos

- Docker Desktop com Docker Compose v2, ou Docker Engine com o plugin Compose.

## Iniciar

Copie o exemplo para `.env` e troque a senha administrativa de desenvolvimento:

```powershell
Copy-Item .env.docker.example .env
```

Edite `SEED_ADMIN_USERS` no `.env`. A senha de cada administrador precisa ter pelo menos 16 caracteres. Os valores desse arquivo são apenas para desenvolvimento local. Configure uma `MFA_ENCRYPTION_KEY` estável se for usar MFA; sem ela, a API deriva a chave da URL local do banco.

Suba os serviços:

```powershell
docker compose up --build -d
```

Quando os serviços estiverem saudáveis, acesse:

- Site: <http://localhost:3000>
- API: <http://localhost:4000/api/auth/status>
- MariaDB: `127.0.0.1:3307` (credenciais locais definidas no `.env`)

Ao iniciar, a API aplica as migrações pendentes e cria o administrador configurado. SMTP e OAuth podem ser configurados no `.env` quando forem necessários.

## Operações

```powershell
docker compose logs -f --tail=100
docker compose down
```

O banco continua salvo no volume `orange_mariadb_data` depois de `docker compose down`. Para apagar todos os dados locais e criar um banco vazio, use `docker compose down --volumes`.

Também existem os atalhos `npm run docker:up`, `npm run docker:down` e `npm run docker:logs` na raiz.

## Produção

Use secrets próprios, backups e HTTPS antes de expor os serviços. A configuração de exemplo, especialmente o administrador, é somente local. Na Hostinger, o Docker Manager é voltado a VPS com o template Docker; a publicação atual pelo fluxo de aplicações Node pode continuar independente deste Compose.
