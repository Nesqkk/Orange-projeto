import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = (await cookies()).get("orange_session")?.value;
  if (!token) redirect("/login");

  const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
  let admin: { email: string; role: string; mfaEnabled: boolean } | null = null;
  try {
    const response = await fetch(`${backendUrl}/api/auth/me`, {
      headers: { cookie: `orange_session=${token}` },
      cache: "no-store",
    });
    if (response.ok) {
      const payload = await response.json() as { email?: string; role?: string; mfaEnabled?: boolean };
      admin = payload.email ? { email: payload.email, role: payload.role ?? "", mfaEnabled: Boolean(payload.mfaEnabled) } : null;
    }
  } catch {
    admin = null;
  }

  if (!admin) redirect("/login");
  if (admin.role !== "ADMIN") redirect("/central-de-operacoes");
  return <AdminDashboard adminEmail={admin.email} mfaEnabled={admin.mfaEnabled} />;
}
