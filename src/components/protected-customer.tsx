"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerOperations } from "@/components/customer-operations";
import { apiFetch } from "@/lib/api";

type Customer = { email: string; name?: string | null; role: string; mfaEnabled: boolean; mfaSetupRequired?: boolean };

export function ProtectedCustomer() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
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
        const user = await response.json() as Customer;
        if (!active) return;
        if (user.role === "ADMIN") {
          router.replace("/admin");
          return;
        }
        setCustomer(user);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível verificar sua sessão.");
      });
    return () => { active = false; };
  }, [router]);

  if (error) return <p role="alert">{error}</p>;
  if (!customer) return <main aria-busy="true" />;
  return <CustomerOperations
    email={customer.email}
    name={customer.name}
    mfaEnabled={customer.mfaEnabled}
    mfaSetupRequired={customer.mfaSetupRequired === true}
  />;
}
