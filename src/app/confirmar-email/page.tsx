import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmEmailScreen } from "@/components/confirm-email-screen";

export const metadata: Metadata = { title: "Confirmar e-mail | Beba Orange", robots: { index: false, follow: false } };

export default function ConfirmEmailPage() {
  return <Suspense fallback={<main aria-busy="true" />}><ConfirmEmailScreen /></Suspense>;
}
