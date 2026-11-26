import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/login-screen";

export const metadata: Metadata = {
  title: "Entrar | Beba Orange",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <Suspense fallback={<main aria-busy="true" />}><LoginScreen /></Suspense>;
}
