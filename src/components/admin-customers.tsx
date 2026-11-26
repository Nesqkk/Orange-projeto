"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, CircleHelp, Download, Pencil, RefreshCw, Search, UserRound, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Customer = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  google?: boolean;
  lastTicketAt?: string | null;
  _count: { tickets: number };
};

type Filter = "ALL" | "VERIFIED" | "PENDING" | "GOOGLE";
const filters: { id: Filter; label: string; test: (customer: Customer) => boolean }[] = [
  { id: "ALL", label: "Todos", test: () => true },
  { id: "VERIFIED", label: "Confirmados", test: (customer) => customer.emailVerified === true },
  { id: "PENDING", label: "Pendentes", test: (customer) => customer.emailVerified === false },
  { id: "GOOGLE", label: "Com Google", test: (customer) => customer.google === true },
];

function csvCell(value: string | number) {
  const text = String(value);
  // Evita que planilhas executem fórmulas vindas de nomes de clientes.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportCsv(customers: Customer[]) {
  const header = ["Nome", "E-mail", "Cadastro", "E-mail confirmado", "Google", "Duas etapas", "Solicitações"];
  const rows = customers.map((customer) => [
    customer.name ?? "", customer.email, customer.createdAt.slice(0, 10),
    customer.emailVerified ? "sim" : "não", customer.google ? "sim" : "não", customer.mfaEnabled ? "sim" : "não", customer._count.tickets,
  ]);
  const csv = "﻿" +[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `clientes-orange-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function responseError(response: Response) {
  const body = await response.text().catch(() => "");
  let payload: { message?: string | string[] } | null = null;
  try { payload = body ? JSON.parse(body) as { message?: string | string[] } : null; } catch {}
  if (Array.isArray(payload?.message)) return payload.message[0];
  return payload?.message ?? `Não foi possível concluir a operação (erro ${response.status}).`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) throw new Error("O servidor retornou uma resposta vazia. Tente novamente.");
  try { return JSON.parse(body) as T; }
  catch { throw new Error("O servidor retornou dados inválidos. Tente novamente."); }
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

export function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/customers", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      setCustomers(await responseJson<Customer[]>(response));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const test = filters.find((item) => item.id === filter)?.test ?? (() => true);
    return customers.filter((customer) => test(customer)
      && (!term || `${customer.name ?? ""} ${customer.email}`.toLocaleLowerCase("pt-BR").includes(term)));
  }, [customers, search, filter]);

  function openEditor(customer: Customer) {
    setEditing(customer);
    setName(customer.name ?? "");
    setError("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/admin/customers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = await responseJson<Customer>(response);
      setCustomers((current) => current.map((customer) => customer.id === updated.id ? updated : customer));
      setEditing(null);
      setNotice("Cadastro do cliente atualizado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="customer-tools">
      <label className="search-field">
        <Search size={17} />
        <input aria-label="Buscar cliente por nome ou e-mail" type="search" placeholder="Buscar cliente por nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="filter-tabs" role="tablist" aria-label="Filtrar clientes">
        {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={`filter-tab ${filter === item.id ? "filter-tab-active" : ""}`} onClick={() => setFilter(item.id)}>{item.label}<span>{customers.filter(item.test).length}</span></button>)}
      </div>
      <div className="tool-actions">
        <button className="secondary-button" type="button" onClick={() => exportCsv(visibleCustomers)} disabled={!visibleCustomers.length}><Download size={15} /> Exportar CSV</button>
        <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "customer-refresh-spinning" : ""} /> Atualizar
        </button>
      </div>
    </section>

    {(error || notice) && <div className={`notice-bar ${error ? "operation-error" : ""}`} role={error ? "alert" : "status"}>
      {error ? <CircleHelp size={16} /> : <Check size={16} />}<span>{error || notice}</span>
      <button type="button" className="icon-button" aria-label="Fechar aviso" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></button>
    </div>}

    <section className="content-panel full-panel customer-panel">
      <div className="panel-heading">
        <div><p className="panel-kicker">RELACIONAMENTO</p><h2>Clientes cadastrados</h2></div>
        <span className="quiet-count">{String(customers.length).padStart(2, "0")} CLIENTES</span>
      </div>
      <div className="customer-table-head"><span>CLIENTE</span><span>CADASTRO</span><span>ATENDIMENTOS</span><span>AÇÕES</span></div>
      {loading ? <div className="operation-empty customer-empty"><RefreshCw size={21} /><strong>Carregando clientes</strong><span>Buscando os cadastros salvos no sistema.</span></div>
        : error && customers.length === 0 ? <div className="operation-empty customer-empty"><UserRound size={23} /><strong>Não foi possível abrir os clientes</strong><span>Confira a conexão com o servidor e tente atualizar.</span></div>
          : visibleCustomers.length === 0 ? <div className="operation-empty customer-empty"><UserRound size={23} /><strong>{customers.length ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</strong><span>{customers.length ? "Tente buscar por outro nome ou e-mail." : "Os clientes que criarem uma conta aparecerão aqui."}</span></div>
            : <div className="customer-list">{visibleCustomers.map((customer) => <article className="customer-row" key={customer.id}>
              <div className="customer-identity"><span className="customer-avatar"><UserRound size={17} /></span><span><strong>{customer.name || "Sem nome"}</strong><small>{customer.email}</small><span className="customer-tags">{customer.emailVerified !== undefined && <em className={customer.emailVerified ? "tag-ok" : "tag-warn"}>{customer.emailVerified ? "Confirmado" : "Pendente"}</em>}{customer.google && <em>Google</em>}{customer.mfaEnabled && <em>2 etapas</em>}</span></span></div>
              <time dateTime={customer.createdAt}>{dateLabel(customer.createdAt)}</time>
              <span className="customer-ticket-count">{customer._count.tickets} {customer._count.tickets === 1 ? "solicitação" : "solicitações"}</span>
              <button type="button" className="customer-edit-button" onClick={() => openEditor(customer)}><Pencil size={14} /> Editar</button>
            </article>)}</div>}
    </section>

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}>
      <section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
        <div className="modal-heading"><div><p className="panel-kicker">CADASTRO DE CLIENTE</p><h2 id="customer-modal-title">Editar cliente</h2></div><button className="icon-button" type="button" aria-label="Fechar" onClick={() => setEditing(null)} disabled={saving}><X size={19} /></button></div>
        <form className="modal-form" onSubmit={saveCustomer}>
          <label htmlFor="customer-name">Nome do cliente</label>
          <input id="customer-name" autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" />
          <p className="form-footnote">E-mail de acesso: {editing.email}</p>
          {error && <p className="customer-form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando…" : <><Check size={16} /> Salvar cliente</>}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
