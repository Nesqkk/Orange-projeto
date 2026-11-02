import type { Metadata } from "next";
import SiteInfoPage from "@/components/site-info-page";

export const metadata: Metadata = {
  title: "Privacidade e dados pessoais",
  description: "Saiba quais dados o site Orange usa para contas, autenticação e atendimento.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  return (
    <SiteInfoPage eyebrow="PRIVACIDADE" title="Seus dados, com clareza." intro="Esta página descreve os dados usados pelas funções de conta e atendimento disponíveis neste projeto.">
      <section>
        <h2>Dados utilizados</h2>
        <p>Ao criar uma conta, o sistema recebe seu e-mail e, se informado, seu nome. A senha é armazenada como um hash protegido, não em texto aberto. Se você usar o suporte, o sistema guarda o assunto e o conteúdo das mensagens da solicitação.</p>
        <p>Para autenticação e recuperação de acesso, o sistema mantém registros de sessão, desafios de autenticação multifator e tokens de redefinição. A configuração MFA pode armazenar um segredo criptografado e hashes dos códigos de recuperação.</p>
      </section>
      <section>
        <h2>Como são usados</h2>
        <p>Essas informações são usadas para criar e proteger contas, autenticar o acesso, permitir a recuperação de senha e responder solicitações de suporte. Os dados são processados pela infraestrutura técnica necessária para operar o site, o banco de dados e o envio de e-mails de recuperação, quando habilitado.</p>
      </section>
      <section>
        <h2>Cookies e armazenamento no navegador</h2>
        <p>A área de conta usa cookies de sessão HTTP-only para manter o acesso e concluir a verificação MFA. A sessão expira após 12 horas; o desafio MFA expira após 5 minutos. O site também guarda sua preferência de tema no armazenamento local do navegador usando a chave <code>orange-tema</code>.</p>
      </section>
      <section>
        <h2>Pedidos sobre seus dados</h2>
        <p>Você pode solicitar confirmação e acesso, correção, informação sobre o uso, portabilidade ou eliminação quando aplicável. Envie seu pedido para <a href="mailto:oi@orange.com.br?subject=Privacidade">oi@orange.com.br</a>. A equipe poderá pedir informações razoáveis para confirmar que está falando com a pessoa titular dos dados.</p>
        <p>Veja também a página da <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares" rel="noreferrer">ANPD sobre direitos dos titulares</a>.</p>
      </section>
      <section>
        <h2>Atualizações</h2>
        <p>Esta descrição acompanha as funções de conta e atendimento atualmente disponíveis. Revisões importantes serão publicadas nesta página.</p>
        <p>Atualizada em 2 de novembro de 2026.</p>
      </section>
    </SiteInfoPage>
  );
}
