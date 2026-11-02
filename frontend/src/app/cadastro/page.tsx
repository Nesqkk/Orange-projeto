import type { Metadata } from "next";
import { AccountForm } from "@/components/account-form";

export const metadata: Metadata = {
  title: "Criar conta | Beba Orange",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <AccountForm mode="register" />;
}
