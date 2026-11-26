"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";
import { apiFetch } from "@/lib/api";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const user = await response.json() as { role?: string };
        if (!active) return;
        if (user.role === "ADMIN") router.replace("/admin");
        if (user.role === "CUSTOMER") router.replace("/central-de-operacoes");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [router]);

  return <SignInPage initialMfaRequired={searchParams.get("mfa") === "1"} oauthError={searchParams.get("oauth") ?? ""} />;
}
