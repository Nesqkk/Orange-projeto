const markdown = `# Orange — O lado mais vivo da sua rotina

> Projeto de marca de bebidas de laranja e experiência digital. Os preços, planos e depoimentos mostrados na página inicial são demonstrativos e não representam uma oferta comercial real.

## Sobre

A Orange apresenta um conceito de suco de laranja, garrafas retornáveis e uma rotina mais viva. Informações finais de ingredientes, conservação, composição nutricional e regras de devolução serão publicadas quando estiverem confirmadas.

## Ideias de produto

- **Solo:** conceito de compra por garrafa.
- **Orange Club:** conceito de assinatura mensal.
- **Orange+:** conceito de bebida enriquecida com colágeno.

Os valores exibidos na página são fictícios e usados apenas como exemplo visual.

## Perguntas frequentes

### O suco é 100% natural?

A proposta da Orange é oferecer suco de laranja 100% natural. As informações finais de ingredientes e conservação serão exibidas no rótulo.

### Como funciona a devolução da garrafa?

A ideia é permitir a devolução em pontos participantes e oferecer cashback conforme as regras do programa, que serão publicadas no lançamento.

### Qual é a diferença do Orange+?

É uma versão opcional enriquecida com colágeno. A composição e as informações nutricionais estarão disponíveis na embalagem.

## Páginas

- [Início](https://bebaorange.com/)
- [Sobre a Orange](https://bebaorange.com/sobre)
- [Contato](https://bebaorange.com/contato)
- [Privacidade](https://bebaorange.com/privacidade)
- [Termos de uso](https://bebaorange.com/termos)

## Atendimento

E-mail: [oi@orange.com.br](mailto:oi@orange.com.br)
`;

export function GET() {
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
