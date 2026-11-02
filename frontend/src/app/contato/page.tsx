import type { Metadata } from "next";
import SiteInfoPage from "@/components/site-info-page";

export const metadata: Metadata = {
  title: "Contato Orange",
  description: "Fale com a equipe Orange pelo canal de atendimento informado no site.",
  alternates: { canonical: "/contato" },
};

export default function ContactPage() {
  return (
    <SiteInfoPage eyebrow="FALE COM A ORANGE" title="Estamos por aqui." intro="Use o e-mail abaixo para dúvidas sobre o site, sua conta ou solicitações de suporte.">
      <section>
        <h2>Atendimento</h2>
        <p><a href="mailto:oi@orange.com.br">oi@orange.com.br</a></p>
        <p>Se você já tem uma conta, também pode acompanhar e responder solicitações pela <a href="/central-de-operacoes">Central de Operações</a>.</p>
      </section>
      <section>
        <h2>Privacidade</h2>
        <p>Para pedir informações ou exercer direitos relacionados aos seus dados pessoais, escreva para o mesmo canal e inclua “Privacidade” no assunto.</p>
      </section>
    </SiteInfoPage>
  );
}
