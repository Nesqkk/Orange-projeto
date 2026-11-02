"use client";

import { useEffect, useState } from "react";
import styles from "@/app/login/login.module.css";

type Providers = { google: boolean; apple: boolean };

export function SocialLoginButtons({ mode = "login" }: { mode?: "login" | "register" }) {
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/oauth/providers", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Providers : null)
      .then((status) => { if (active && status) setProviders(status); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const available = providers ? (["google", "apple"] as const).filter((provider) => providers[provider]) : [];
  if (!available.length) return null;

  return (
    <div className={styles.socialSection}>
      <div className={styles.divider}><span>ou continue com</span></div>
      <div className={styles.socialButtons}>
        {available.map((provider) => (
          <a key={provider} className={styles.socialButton} href={`/api/auth/oauth/${provider}`}>
            <span className={provider === "google" ? styles.googleMark : styles.appleMark} aria-hidden="true">
              {provider === "google" ? "G" : "A"}
            </span>
            {mode === "register" ? "Criar conta com" : "Continuar com"} {provider === "google" ? "Google" : "Apple"}
          </a>
        ))}
      </div>
    </div>
  );
}
