# Orange — guia do frontend

Este guia mostra onde encontrar cada parte da interface.

## Estrutura

- `src/app/page.tsx`: monta a página inicial e controla o menu, o tema e a mudança de atmosfera durante a rolagem.
- `src/app/layout.tsx`: configura o idioma e os metadados do site.
- `src/app/globals.css`: importa o arquivo principal de estilos.
- `src/styles/site.css`: contém os estilos visuais, responsividade, animações e cores.
- `src/components/orange/StaggerTestimonials.tsx`: carrossel de avaliações em cartões sobrepostos.
- `src/components/orange/MorphingPageDots.tsx`: setas e indicadores para trocar a avaliação ativa.
- `public/orange-logo.png`: imagem da marca utilizada no site.

## Como executar

1. Instale uma versão LTS recente do Node.js.
2. No terminal, entre na pasta `bebaorange`.
3. Execute `npm install`.
4. Execute `npm run dev`.
5. Abra `http://localhost:3000` no navegador.

## Onde fazer alterações

- **Título e texto principal:** `src/app/page.tsx`, seção `Hero`.
- **Logo e links do topo:** `src/app/page.tsx`, componente `header`.
- **Nome, preço e benefícios dos planos:** lista `plans` em `src/app/page.tsx`.
- **Textos das avaliações:** lista `testimonials` em `src/components/orange/StaggerTestimonials.tsx`.
- **Aparência, espaçamento e versão mobile:** `src/styles/site.css`.

## Observações

Os preços e depoimentos atuais são fictícios e servem somente para demonstrar o layout. Antes da publicação, substitua depoimentos por relatos reais autorizados e confirme os dados comerciais do produto.


## Estrutura integrada nesta versão

- `src/app/page.tsx`: página inicial e composição das seções.
- `src/styles/site.css`: estilos visuais do site, responsividade e tema.
- `src/components/orange/StaggerTestimonials.tsx`: cartões de avaliações.
- `src/components/orange/MorphingPageDots.tsx`: setas e indicadores de navegação.
- `public/orange-logo.png`: símbolo da marca.

O hero mantém apenas a logo-símbolo, o título, a descrição, o botão e a garrafa. O selo
“Sabor de fruta. Sem atalhos.” foi removido. A versão integra também as seções de conceito,
benefícios, planos, avaliações, perguntas frequentes e chamada final com base no código
compartilhado pelo parceiro. Os preços e depoimentos continuam sendo exemplos fictícios.

Para executar localmente, instale as dependências com `npm install` e use `npm run dev`.
