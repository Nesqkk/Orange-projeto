import type { Metadata } from "next";
import SiteInfoPage from "@/components/site-info-page";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Condições de uso do site e das contas Orange.",
  alternates: { canonical: "/termos" },
};

export default function TermsPage() {
  return (
    <SiteInfoPage eyebrow="TERMOS DE USO" title="Como usar este site." intro="Ao navegar ou criar uma conta, use as páginas e os canais Orange de forma lícita e respeitosa.">
      <section>
        <h2>Conteúdo e ofertas</h2>
        <p>O site apresenta o conceito Orange. Os preços, planos e depoimentos da página inicial são demonstrações de layout: não são preços vigentes, promessas de entrega ou avaliações reais. A página não conclui compras nem pagamentos.</p>
        <p>Informações definitivas de produto, ingredientes, conservação, composição nutricional e regras de devolução serão publicadas quando estiverem confirmadas.</p>
      </section>
      <section>
        <h2>Contas e suporte</h2>
        <p>Informe dados corretos ao criar sua conta, proteja suas credenciais e use a conta para solicitações legítimas. A Central de Operações permite abrir e acompanhar solicitações de suporte.</p>
        <p>Se notar acesso indevido ou não conseguir entrar, fale com <a href="mailto:oi@orange.com.br">oi@orange.com.br</a>.</p>
      </section>
      <section>
        <h2>Disponibilidade e alterações</h2>
        <p>As páginas e funções podem ser atualizadas para corrigir informações, manter a segurança ou melhorar o serviço. Uma atualização desta página passa a valer a partir da publicação.</p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:oi@orange.com.br?subject=Termos%20de%20uso">oi@orange.com.br</a>.</p>
        <p>Atualizado em 2 de novembro de 2026.</p>
      </section>
    </SiteInfoPage>
  );
}
