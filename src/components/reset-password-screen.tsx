"use client";

import { useSearchParams } from "next/navigation";
import { AccountForm } from "@/components/account-form";

export function ResetPasswordScreen() {
  const searchParams = useSearchParams();
  return <AccountForm mode="reset" token={searchParams.get("token") ?? ""} />;
}
