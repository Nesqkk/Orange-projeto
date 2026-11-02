"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

type Setup = { secret: string; otpauthUrl: string };

async function message(response: Response) {
  const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
  return Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? "Não foi possível concluir a solicitação.";
}

export function AdminMfaSettings({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function startSetup() {
    setBusy(true); setError(""); setNotice(""); setBackupCodes([]);
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST" });
      if (!response.ok) throw new Error(await message(response));
      setSetup(await response.json() as Setup);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível iniciar o MFA."); }
    finally { setBusy(false); }
  }

  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (!response.ok) throw new Error(await message(response));
      const result = await response.json() as { enabled: boolean; backupCodes: string[] };
      setEnabled(result.enabled); setBackupCodes(result.backupCodes); setSetup(null); setCode(""); setNotice("MFA ativado. Guarde seus códigos de recuperação.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível ativar o MFA."); }
    finally { setBusy(false); }
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (!response.ok) throw new Error(await message(response));
      setEnabled(false); setCode(""); setBackupCodes([]); setNotice("MFA desativado.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível desativar o MFA."); }
    finally { setBusy(false); }
  }

  return <section className="content-panel admin-security-panel">
    <div className="panel-heading"><div><p className="panel-kicker">PROTEÇÃO DA CONTA</p><h2><ShieldCheck size={18} /> Autenticação em duas etapas</h2></div><span className={`operation-status ${enabled ? "operation-status-resolved" : "operation-status-open"}`}>{enabled ? "Ativada" : "Desativada"}</span></div>
    <p className="admin-security-copy">Use um app autenticador para exigir um código adicional no acesso ao painel. O segredo é criptografado no banco de dados e os códigos de recuperação só aparecem uma vez.</p>
    {error && <p className="admin-security-error" role="alert">{error}</p>}{notice && <p className="admin-security-notice" role="status">{notice}</p>}
    {setup && <div className="admin-security-setup"><p>Adicione esta chave manualmente no seu app autenticador:</p><code>{setup.secret}</code><a href={setup.otpauthUrl}><KeyRound size={14} /> Abrir no app compatível</a><form className="admin-security-form" onSubmit={enable}><label htmlFor="admin-mfa-code">Código de 6 dígitos</label><input id="admin-mfa-code" autoComplete="one-time-code" inputMode="numeric" minLength={6} maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /><button className="primary-button" type="submit" disabled={busy}>{busy ? "Verificando…" : "Confirmar MFA"}</button></form></div>}
    {enabled && !setup ? <form className="admin-security-form admin-security-disable" onSubmit={disable}><label htmlFor="disable-admin-mfa">Código atual ou de recuperação</label><input id="disable-admin-mfa" minLength={6} maxLength={32} value={code} onChange={(event) => setCode(event.target.value)} required /><button className="secondary-button" type="submit" disabled={busy}>{busy ? "Aguarde…" : "Desativar MFA"}</button></form> : !setup && <button className="primary-button" type="button" onClick={startSetup} disabled={busy}>{busy ? "Preparando…" : "Configurar MFA"}</button>}
    {backupCodes.length > 0 && <div className="admin-backup-wrap"><p>Salve estes códigos agora. Cada um só pode ser usado uma vez.</p><div className="admin-backup-codes">{backupCodes.map((item) => <code key={item}>{item}</code>)}</div></div>}
  </section>;
}
