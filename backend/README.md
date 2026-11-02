# Orange Backend (starter)

Scaffold inicial do back-end de autenticação da Orange, separado do front-end Next.js existente.

## Requisitos
- Node.js 20+
- npm
- PostgreSQL (para a próxima etapa; o scaffold ainda não consulta o banco)

## Instalar e executar
```bash
npm install
cp .env.example .env
npm run start:dev
```
API local: `http://localhost:4000`

## Estrutura
```text
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   └── auth.module.ts
│   ├── app.module.ts
│   └── main.ts
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

## Escopo atual
- Base NestJS/TypeScript
- Endpoint de status para verificar se a API está ativa
- Módulo de autenticação separado, pronto para receber login
- Modelo inicial `User` no Prisma

**Ainda não implementado:** cadastro, validação de credenciais, sessão/cookies, recuperação de senha ou pagamentos. Não use em produção antes de implementar e testar a autenticação.

## Próximas tarefas
1. Instalar/configurar Prisma e conectar PostgreSQL.
2. Criar migration do modelo `User`.
3. Implementar validação DTO e login.
4. Hash de senha com Argon2.
5. Criar sessão segura em cookie `HttpOnly`, `Secure` em produção e `SameSite`.
6. Integrar o formulário do Next.js com `POST /auth/login`.
