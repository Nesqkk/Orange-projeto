import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orange — O lado mais vivo da sua rotina",
  description: "Suco de laranja 100% natural, uma experiência mais consciente e um jeito novo de sentir o frescor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
