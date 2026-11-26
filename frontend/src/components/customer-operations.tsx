"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/central-de-operacoes/portal.module.css";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketMessage = { id: string; content: string; createdAt: string; author: { id: string; name: string | null; email: string; role: "ADMIN" | "CUSTOMER" } };
type Ticket = { id: string; subject: string; status: TicketStatus; createdAt: string; updatedAt: string; messages: TicketMessage[] };
type MfaSetup = { secret: string; otpauthUrl: string };

const statusLabels: Record<TicketStatus, string> = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido", CLOSED: "Encerrado" };

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
  return Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? "Não foi possível concluir a solicitação.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function CustomerOperations({ email, name, mfaEnabled: initialMfa }: { email: string; name?: string | null; mfaEnabled: boolean }) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(initialMfa);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  async function loadTickets() {
    try {
      const response = await fetch("/api/support/tickets", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = await response.json() as Ticket[];
      setTickets(data);
      if (data.length && !selectedId) setSelectedId(data[0].id);
      if (!data.length) setSelectedId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os atendimentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTickets(); }, []);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: form.get("subject"), content: form.get("content") }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const ticket = await response.json() as Ticket;
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id); setShowComposer(false); setNotice("Solicitação enviada. A equipe Orange responderá por aqui.");
      formElement.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível abrir o atendimento.");
    } finally { setBusy(false); }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/support/tickets/${selected.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: reply }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const ticket = await response.json() as Ticket;
      setTickets((current) => current.map((item) => item.id === ticket.id ? ticket : item).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
      setReply("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem."); }
    finally { setBusy(false); }
  }

  async function startMfa() {
    setBusy(true); setError(""); setNotice(""); setBackupCodes([]);
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMfaSetup(await response.json() as MfaSetup);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível iniciar o MFA."); }
    finally { setBusy(false); }
  }

  async function confirmMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/enable", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: mfaCode }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { enabled: boolean; backupCodes: string[] };
      setMfaEnabled(result.enabled); setBackupCodes(result.backupCodes); setMfaSetup(null); setMfaCode("");
      setNotice("MFA ativado. Guarde os códigos de recuperação em um local seguro.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível ativar o MFA."); }
    finally { setBusy(false); }
  }

  async function disableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/disable", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: mfaCode }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMfaEnabled(false); setBackupCodes([]); setMfaCode(""); setNotice("MFA desativado.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível desativar o MFA."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login"); router.refresh();
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/"><span className={styles.brandIcon}>O</span><span>BEBA ORANGE</span></a>
        <div className={styles.topActions}><span>{email}</span><button type="button" onClick={logout}>Sair</button></div>
      </header>
      <div className={styles.pageContent}>
        <div className={styles.heading}>
          <div><p className={styles.eyebrow}>CENTRAL DE OPERAÇÕES / CLIENTE</p><h1>Atendimento</h1><p>Olá{name ? `, ${name}` : ""}. Acompanhe suas solicitações e converse com a equipe Orange.</p></div>
          <button className={styles.primaryButton} type="button" onClick={() => { setShowComposer((value) => !value); setError(""); }}>{showComposer ? "Voltar aos chamados" : "Nova solicitação"}</button>
        </div>

        {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
        <div className={styles.columns}>
          <section className={styles.panel} aria-label="Minhas solicitações">
            <div className={styles.panelHeader}><h2>Minhas solicitações</h2><p>{tickets.length} {tickets.length === 1 ? "chamado" : "chamados"}</p></div>
            {loading ? <div className={styles.empty}><span>Carregando solicitações…</span></div> : tickets.length ? <div className={styles.ticketList}>
              {tickets.map((ticket) => <button key={ticket.id} className={`${styles.ticketItem} ${ticket.id === selectedId && !showComposer ? styles.ticketSelected : ""}`} onClick={() => { setSelectedId(ticket.id); setShowComposer(false); setError(""); }}>
                <span className={styles.ticketTitle}><strong>{ticket.subject}</strong><small>{ticket.messages.length} {ticket.messages.length === 1 ? "mensagem" : "mensagens"} · atualizado {formatDate(ticket.updatedAt)}</small></span>
                <span className={styles.status} data-status={ticket.status}>{statusLabels[ticket.status]}</span>
              </button>)}
            </div> : <div className={styles.empty}><strong>Nenhuma solicitação ainda</strong><span>Quando precisar de ajuda, abra um chamado para falar com a equipe Orange.</span></div>}
          </section>

          <section className={styles.panel} aria-label={showComposer ? "Nova solicitação" : "Conversa de atendimento"}>
            {showComposer ? <><div className={styles.panelHeader}><h2>Nova solicitação</h2><p>Descreva como podemos ajudar.</p></div><div className={styles.detail}><form className={styles.newTicketForm} onSubmit={submitTicket}>
              <label className={styles.formLabel} htmlFor="subject">Assunto</label><input className={styles.formInput} id="subject" name="subject" minLength={4} maxLength={160} placeholder="Ex.: Dúvida sobre meu pedido" required />
              <label className={styles.formLabel} htmlFor="content">Mensagem</label><textarea className={styles.formTextarea} id="content" name="content" minLength={10} maxLength={4000} placeholder="Conte os detalhes da sua solicitação…" required />
              <div className={styles.formFoot}><span className={styles.ticketDate}>Você poderá acompanhar as respostas nesta página.</span><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitação"}</button></div>
            </form></div></> : selected ? <div className={styles.detail}>
              <div className={styles.ticketHeading}><div><h2>{selected.subject}</h2><p>Aberto em {formatDate(selected.createdAt)}</p></div><span className={styles.status} data-status={selected.status}>{statusLabels[selected.status]}</span></div>
              <div className={styles.messages}>{selected.messages.map((message) => <article key={message.id} className={`${styles.message} ${message.author.role === "CUSTOMER" ? styles.messageMine : ""}`}>
                <div className={styles.messageTop}><strong>{message.author.role === "ADMIN" ? "Equipe Orange" : "Você"}</strong><time>{formatDate(message.createdAt)}</time></div><p>{message.content}</p>
              </article>)}</div>
              {selected.status !== "CLOSED" ? <form className={styles.replyForm} onSubmit={submitReply}><label className={styles.formLabel} htmlFor="reply">Responder</label><textarea className={styles.formTextarea} id="reply" value={reply} onChange={(event) => setReply(event.target.value)} minLength={2} maxLength={4000} placeholder="Escreva sua mensagem…" required /><div className={styles.formFoot}><span className={styles.ticketDate}>A equipe será notificada pela Central de Operações.</span><button className={styles.primaryButton} type="submit" disabled={busy || !reply.trim()}>{busy ? "Enviando…" : "Enviar mensagem"}</button></div></form> : <p className={styles.notice}>Esta solicitação foi encerrada. Se precisar de mais ajuda, crie um novo chamado.</p>}
            </div> : <div className={styles.empty}><strong>Converse com a equipe Orange</strong><span>Selecione uma solicitação para acompanhar as mensagens ou crie um novo chamado.</span></div>}
          </section>
        </div>

        <section className={`${styles.panel} ${styles.securityPanel}`}>
          <div className={styles.securityTop}><span className={styles.status} data-status={mfaEnabled ? "RESOLVED" : "OPEN"}>{mfaEnabled ? "Protegida" : "Opcional"}</span><h2>Autenticação em duas etapas (MFA)</h2></div>
          <p>Use um app autenticador para adicionar uma confirmação ao entrar na sua conta. Você também recebe códigos de recuperação para emergências.</p>
          {mfaSetup && <><p>Adicione a conta manualmente no app autenticador com esta chave:</p><div className={styles.secretBox}>{mfaSetup.secret}</div><p><a href={mfaSetup.otpauthUrl} className={styles.notice}>Abrir no app autenticador compatível</a></p><form className={styles.securityActions} onSubmit={confirmMfa}><input className={styles.formInput} aria-label="Código do app autenticador" inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} minLength={6} maxLength={6} required /><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Verificando…" : "Ativar MFA"}</button><button type="button" className={styles.textButton} onClick={() => { setMfaSetup(null); setMfaCode(""); }}>Cancelar</button></form></>}
          {mfaEnabled && !mfaSetup ? <form className={styles.securityActions} onSubmit={disableMfa}><input className={styles.formInput} aria-label="Código para desativar MFA" placeholder="Código atual ou de recuperação" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} minLength={6} maxLength={32} required /><button className={styles.secondaryButton} type="submit" disabled={busy}>{busy ? "Aguarde…" : "Desativar MFA"}</button></form> : !mfaSetup && <div className={styles.securityActions}><button className={styles.secondaryButton} type="button" onClick={startMfa} disabled={busy}>{busy ? "Preparando…" : "Configurar MFA"}</button></div>}
          {backupCodes.length > 0 && <><p>Salve estes códigos agora. Cada código só pode ser usado uma vez e não poderá ser exibido novamente.</p><div className={styles.backupCodes}>{backupCodes.map((code) => <code key={code}>{code}</code>)}</div></>}
        </section>
      </div>
    </main>
  );
}
