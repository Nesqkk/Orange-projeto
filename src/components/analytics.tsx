"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CADASTRO_EVENT, GA_ID, META_PIXEL_ID, analyticsEnabled, initAnalytics, trackCadastro, trackPageView } from "@/lib/analytics";

// Carrega Meta Pixel e GA4 só se houver ID, com lazyOnload (depois do load da página,
// em tempo ocioso) para não competir com o conteúdo no celular. Os eventos disparados
// antes disso ficam na fila do fbq/gtag.
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
    // Telas que não importam a lib avisam o cadastro com uma linha:
    // window.dispatchEvent(new CustomEvent("orange:cadastro", { detail: { method: "email" } }))
    const onCadastro = (event: Event) => trackCadastro((event as CustomEvent<{ method?: string } | null>).detail ?? {});
    window.addEventListener(CADASTRO_EVENT, onCadastro);
    return () => window.removeEventListener(CADASTRO_EVENT, onCadastro);
  }, []);

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  if (!analyticsEnabled) return null;

  return (
    <>
      {GA_ID ? (
        <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="lazyOnload" />
      ) : null}
      {META_PIXEL_ID ? (
        <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="lazyOnload" />
      ) : null}
    </>
  );
}
