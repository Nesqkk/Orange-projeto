"use client";

import { useSearchParams } from "next/navigation";
import { EmailVerification } from "@/components/email-verification";

export function ConfirmEmailScreen() {
  const searchParams = useSearchParams();
  return <EmailVerification token={searchParams.get("token") ?? ""} />;
}
