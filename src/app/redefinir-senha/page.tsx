import { Suspense } from "react";
import { ResetPasswordScreen } from "@/components/reset-password-screen";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main aria-busy="true" />}><ResetPasswordScreen /></Suspense>;
}
