import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orange — O lado mais vivo da sua rotina",
  description: "Suco de laranja 100% natural, uma experiência mais consciente e um jeito novo de sentir o frescor.",
  openGraph: {
    title: "Orange — O lado mais vivo da sua rotina",
    description: "Suco de laranja 100% natural, em garrafa retornável com cashback.",
    locale: "pt_BR",
    type: "website",
  },
};

// Cor da barra do navegador no celular, acompanhando o tema do aparelho.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070707" },
    { media: "(prefers-color-scheme: light)", color: "#f4f1e9" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
