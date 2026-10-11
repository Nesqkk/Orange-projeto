"use client";

import { useRouter } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";

export default function LoginPage() {
  const router = useRouter();

  return <SignInPage onSignIn={() => router.push("/")} />;
}