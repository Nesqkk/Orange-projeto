import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bebaorange.com"),
  title: "Orange — O lado mais vivo da sua rotina",
  description: "Suco de laranja 100% natural, uma experiência mais consciente e um jeito novo de sentir o frescor.",
  alternates: {
    canonical: "/",
    types: {
      "text/markdown": "/markdown/home",
      "text/plain": "/llms.txt",
    },
  },
  openGraph: {
    title: "Orange — O lado mais vivo da sua rotina",
    description: "Suco de laranja 100% natural, em garrafa retornável com cashback.",
    url: "https://bebaorange.com/",
    siteName: "Orange",
    locale: "pt_BR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

// Cor da barra do navegador no celular, acompanhando o tema do aparelho.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070707" },
    { media: "(prefers-color-scheme: light)", color: "#f4f1e9" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://bebaorange.com/#organization",
        name: "Orange",
        url: "https://bebaorange.com/",
        logo: "https://bebaorange.com/orange-logo.png",
        email: "oi@orange.com.br",
        description: "Projeto de marca de bebidas de laranja. O site apresenta conceitos e preços ilustrativos.",
        sameAs: ["https://github.com/Nesqkk/Orange-projeto"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Atendimento ao cliente",
          email: "oi@orange.com.br",
          availableLanguage: ["Portuguese"],
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://bebaorange.com/#website",
        url: "https://bebaorange.com/",
        name: "Orange",
        inLanguage: "pt-BR",
        publisher: { "@id": "https://bebaorange.com/#organization" },
      },
    ],
  };

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
