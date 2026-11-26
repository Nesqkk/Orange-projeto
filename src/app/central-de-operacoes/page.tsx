import type { Metadata } from "next";
import { ProtectedCustomer } from "@/components/protected-customer";

export const metadata: Metadata = { title: "Central de operações | Beba Orange", robots: { index: false, follow: false } };

export default function CustomerOperationsPage() {
  return <ProtectedCustomer />;
}
