import type { Metadata } from "next";
import SiteInfoPage from "@/components/site-info-page";

export const metadata: Metadata = {
  title: "Sobre a Orange",
  description: "Conheça o projeto e o conceito da Orange.",
  alternates: { canonical: "/sobre" },
};

export default function AboutPage() {
  return (
    <SiteInfoPage eyebrow="SOBRE A ORANGE" title="Um projeto com frescor." intro="A Orange apresenta um conceito de marca e uma experiência digital para bebidas de laranja.">
      <section>
        <h2>O conceito</h2>
        <p>O projeto explora suco de laranja, garrafas retornáveis e uma rotina mais viva. A página reúne ideias de produto e uma demonstração visual da experiência Orange.</p>
      </section>
      <section>
        <h2>Informações demonstrativas</h2>
        <p>Os preços dos planos e os depoimentos exibidos na página inicial são fictícios, usados para demonstrar o layout. Eles não constituem uma oferta comercial nem relatos de clientes reais.</p>
        <p>Detalhes finais de ingredientes, conservação, composição nutricional e regras de devolução dependem de publicação oficial do produto.</p>
      </section>
      <section>
        <h2>Projeto</h2>
        <p>O código-fonte público deste site está no <a href="https://github.com/Nesqkk/Orange-projeto" rel="noreferrer">repositório Orange-projeto no GitHub</a>.</p>
      </section>
    </SiteInfoPage>
  );
}
