import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";

export const metadata: Metadata = {
  title: "Entrar | Beba Orange",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mfa?: string; oauth?: string }> }) {
  const params = await searchParams;
  const token = (await cookies()).get("orange_session")?.value;
  if (token) {
    const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
    let destination: string | null = null;
    try {
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        headers: { cookie: `orange_session=${token}` },
        cache: "no-store",
      });
      if (response.ok) {
        const user = await response.json() as { role?: string };
        if (user.role === "ADMIN") destination = "/admin";
        if (user.role === "CUSTOMER") destination = "/central-de-operacoes";
      }
    } catch {
      destination = null;
    }
    if (destination) redirect(destination);
  }

  return <SignInPage initialMfaRequired={params.mfa === "1"} oauthError={params.oauth ?? ""} />;
}
