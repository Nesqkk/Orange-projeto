"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, CircleHelp, MessageSquareText, RefreshCw } from "lucide-react";

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Message = { id: string; content: string; createdAt: string; author: { id: string; email: string; name: string | null; role: "ADMIN" | "CUSTOMER" } };
type Ticket = { id: string; subject: string; status: Status; createdAt: string; updatedAt: string; user: { id: string; email: string; name: string | null }; messages: Message[] };
type Filter = "ALL" | Status;

const labels: Record<Status, string> = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido", CLOSED: "Encerrado" };
const filters: { id: Filter; label: string }[] = [
  { id: "ALL", label: "Todos" }, { id: "OPEN", label: "Abertos" }, { id: "IN_PROGRESS", label: "Em atendimento" }, { id: "RESOLVED", label: "Resolvidos" },
];

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  return Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Não foi possível concluir.";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const visible = tickets.filter((ticket) => filter === "ALL" || ticket.status === filter);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/operations/tickets", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as Ticket[];
      setTickets(data);
      setSelectedId((current) => current && data.some((item) => item.id === current) ? current : data[0]?.id ?? "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar os chamados."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/support/tickets/${selected.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: reply }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = await response.json() as Ticket;
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
      setReply(""); setNotice("Resposta enviada ao cliente.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível enviar a resposta."); }
    finally { setBusy(false); }
  }

  async function changeStatus(status: Status) {
    if (!selected || status === selected.status) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/operations/tickets/${selected.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = await response.json() as Ticket;
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
      setNotice(`Solicitação marcada como ${labels[status].toLowerCase()}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o status."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="support-toolbar">
      <div className="filter-tabs" role="tablist" aria-label="Filtrar solicitações">
        {filters.map((item) => <button key={item.id} className={`filter-tab ${filter === item.id ? "filter-tab-active" : ""}`} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{item.id === "ALL" ? tickets.length : tickets.filter((ticket) => ticket.status === item.id).length}</span></button>)}
      </div>
      <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Atualizar</button>
    </section>
    {(error || notice) && <div className={`notice-bar ${error ? "operation-error" : ""}`} role={error ? "alert" : "status"}>{error ? <CircleHelp size={16} /> : <Check size={16} />}<span>{error || notice}</span><button type="button" className="icon-button" aria-label="Fechar aviso" onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
    {loading ? <div className="content-panel operation-empty"><RefreshCw size={21} /><strong>Carregando solicitações</strong><span>Buscando os atendimentos da Central de Operações.</span></div> : tickets.length === 0 ? <div className="content-panel operation-empty"><MessageSquareText size={24} /><strong>Nenhuma solicitação por aqui</strong><span>Os chamados enviados pelos clientes aparecerão nesta fila.</span></div> : visible.length === 0 ? <div className="content-panel operation-empty"><MessageSquareText size={24} /><strong>Nenhuma solicitação neste filtro</strong><span>Escolha outro status para consultar os atendimentos.</span></div> : <section className="operation-inbox">
      <div className="content-panel operation-list">
        <div className="operation-list-heading"><div><p className="panel-kicker">FILA DE ATENDIMENTO</p><h2>Solicitações dos clientes</h2></div><span className="quiet-count">{String(visible.length).padStart(2, "0")}</span></div>
        <div className="operation-ticket-list">{visible.map((ticket) => <button type="button" key={ticket.id} className={`operation-ticket ${ticket.id === selectedId ? "operation-ticket-active" : ""}`} onClick={() => { setSelectedId(ticket.id); setNotice(""); setError(""); }}>
          <span className="operation-ticket-top"><strong>{ticket.subject}</strong><span className={`operation-status operation-status-${ticket.status.toLowerCase()}`}>{labels[ticket.status]}</span></span>
          <span className="operation-customer">{ticket.user.name || ticket.user.email}</span>
          <span className="operation-ticket-bottom"><span>{ticket.messages.length} {ticket.messages.length === 1 ? "mensagem" : "mensagens"}</span><time>{dateLabel(ticket.updatedAt)}</time></span>
        </button>)}</div>
      </div>
      <div className="content-panel operation-thread">
        {selected ? <>
          <div className="operation-thread-head"><div><p className="panel-kicker">{selected.user.email}</p><h2>{selected.subject}</h2><span>Aberto em {dateLabel(selected.createdAt)}</span></div>
            <label className="operation-status-select"><span>Status</span><select value={selected.status} onChange={(event) => void changeStatus(event.target.value as Status)} disabled={busy}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          </div>
          <div className="operation-messages">{selected.messages.map((message) => <article key={message.id} className={`operation-message ${message.author.role === "ADMIN" ? "operation-message-team" : ""}`}>
            <div><strong>{message.author.role === "ADMIN" ? message.author.name || "Equipe Orange" : message.author.name || message.author.email}</strong><time>{dateLabel(message.createdAt)}</time></div><p>{message.content}</p>
          </article>)}</div>
          {selected.status !== "CLOSED" ? <form className="operation-reply" onSubmit={sendReply}><label htmlFor="operation-reply">Responder ao cliente</label><textarea id="operation-reply" value={reply} onChange={(event) => setReply(event.target.value)} minLength={2} maxLength={4000} placeholder="Escreva uma resposta…" required /><div><span>O cliente verá a resposta na Central de Operações.</span><button className="primary-button" type="submit" disabled={busy || !reply.trim()}>{busy ? "Enviando…" : "Enviar resposta"}</button></div></form> : <p className="operation-closed">Esta solicitação está encerrada. Atualize o status para continuar a conversa.</p>}
        </> : <div className="operation-empty"><strong>Selecione uma solicitação</strong><span>As mensagens do cliente serão exibidas aqui.</span></div>}
      </div>
    </section>}
  </>;
}
