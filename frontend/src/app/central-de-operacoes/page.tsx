import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerOperations } from "@/components/customer-operations";

export const dynamic = "force-dynamic";

export default async function CustomerOperationsPage() {
  const token = (await cookies()).get("orange_session")?.value;
  if (!token) redirect("/login");
  const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
  let user: { email: string; name?: string | null; role: string; mfaEnabled: boolean } | null = null;
  try {
    const response = await fetch(`${backendUrl}/api/auth/me`, { headers: { cookie: `orange_session=${token}` }, cache: "no-store" });
    if (response.ok) user = await response.json();
  } catch { user = null; }
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin");
  return <CustomerOperations email={user.email} name={user.name} mfaEnabled={user.mfaEnabled} />;
}
