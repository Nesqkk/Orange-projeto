# Frontend Orange

Aplicação Next.js responsável pelo site público, cadastro/login, área do cliente e painel web.

## Estrutura

- `src/app/`: páginas, rotas e metadados do Next.js.
- `src/components/`: componentes compartilhados, formulários e painéis.
- `src/lib/`: hooks e utilitários do navegador.
- `src/styles/`: estilos visuais do site e do painel.
- `public/`: imagens, modelos 3D e arquivos públicos.
- `next.config.mjs`: encaminha `/api/*` para o backend usando `BACKEND_URL`.

## Executar

Na raiz do repositório, instale as dependências e inicie o frontend:

```powershell
npm --prefix frontend install
npm run dev
```

Para iniciar diretamente a partir desta pasta:

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000`. O backend deve estar em execução na porta `4000` para os recursos de conta, clientes e suporte.

## Build

```powershell
npm run build
```

No deploy, configure `BACKEND_URL` com a origem da API antes da compilação. Veja as instruções de produção no `DEPLOY-HOSTINGER.md` da raiz.
