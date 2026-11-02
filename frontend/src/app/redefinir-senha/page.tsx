import { AccountForm } from "@/components/account-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <AccountForm mode="reset" token={params.token ?? ""} />;
}
