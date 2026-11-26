"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { apiFetch } from "@/lib/api";

type Admin = { email: string; role: string; mfaEnabled: boolean };

export function ProtectedAdmin() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("Não foi possível verificar sua sessão.");
        const user = await response.json() as Admin;
        if (!active) return;
        if (user.role !== "ADMIN") {
          router.replace("/central-de-operacoes");
          return;
        }
        setAdmin(user);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível verificar sua sessão.");
      });
    return () => { active = false; };
  }, [router]);

  if (error) return <p role="alert">{error}</p>;
  if (!admin) return <main aria-busy="true" />;
  return <AdminDashboard adminEmail={admin.email} mfaEnabled={admin.mfaEnabled} />;
}
