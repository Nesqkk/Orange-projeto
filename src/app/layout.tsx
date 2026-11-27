import type { Metadata, Viewport } from "next";
import { Archivo_Black, DM_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";

const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-archivo-black" });
const dmMono = DM_Mono({ weight: ["400", "500"], subsets: ["latin"], display: "swap", variable: "--font-dm-mono" });
const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], display: "swap", variable: "--font-fraunces" });

export const metadata: Metadata = {
  metadataBase: new URL("https://app.bebaorange.com"),
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
    url: "https://app.bebaorange.com/",
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
        "@id": "https://app.bebaorange.com/#organization",
        name: "Orange",
        url: "https://app.bebaorange.com/",
        logo: "https://app.bebaorange.com/orange-logo-512.png",
        email: "oi@orange.com.br",
        description: "Projeto de marca de bebidas de laranja. O site apresenta conceitos e preços ilustrativos.",
        sameAs: ["https://github.com/Nesqkk/Orange-projeto"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Atendimento ao cliente",
          url: "https://app.bebaorange.com/contato",
          email: "oi@orange.com.br",
          availableLanguage: ["pt-BR"],
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://app.bebaorange.com/#website",
        url: "https://app.bebaorange.com/",
        name: "Orange",
        inLanguage: "pt-BR",
        publisher: { "@id": "https://app.bebaorange.com/#organization" },
      },
      {
        "@type": "ItemList",
        "@id": "https://app.bebaorange.com/#main-navigation",
        name: "Páginas institucionais Orange",
        itemListElement: [
          { "@type": "SiteNavigationElement", position: 1, name: "Sobre", url: "https://app.bebaorange.com/sobre" },
          { "@type": "SiteNavigationElement", position: 2, name: "Contato", url: "https://app.bebaorange.com/contato" },
          { "@type": "SiteNavigationElement", position: 3, name: "Termos", url: "https://app.bebaorange.com/termos" },
        ],
      },
    ],
  };

  return (
    <html lang="pt-BR" className={`${archivoBlack.variable} ${dmMono.variable} ${fraunces.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </head>
      <body>{children}<Analytics /></body>
    </html>
  );
}
