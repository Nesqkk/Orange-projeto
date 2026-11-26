import type { Metadata } from "next";
import { ProtectedAdmin } from "@/components/protected-admin";

export const metadata: Metadata = { title: "Admin | Beba Orange", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <ProtectedAdmin />;
}
