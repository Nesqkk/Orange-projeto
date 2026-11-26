"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowUpRight, Cable, Check, CircleHelp, MailCheck, MessageSquareText,
  Moon, Plus, RefreshCw, Settings2, ShieldCheck, Snowflake, Sun, Trash2, UserRound, UsersRound, X,
} from "lucide-react";
import { Sidebar, type DashboardView } from "@/components/ui/sidebar";
import { AdminSupport } from "@/components/admin-support";
import { AdminCustomers } from "@/components/admin-customers";
import { AdminMfaSettings } from "@/components/admin-mfa-settings";
import { AdminBroadcasts } from "@/components/admin-broadcasts";
import { apiFetch } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  priceInCents: number;
  interval: "MONTHLY" | "YEARLY" | "ONCE";
  active: boolean;
}

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface OverviewData {
  customers: { total: number; last30: number; last7: number; verified: number; mfa: number; google: number };
  tickets: Record<TicketStatus, number> & { awaitingReply: number };
  plans: { total: number; active: number };
  signups: { day: string; total: number }[];
  recentTickets: { id: string; subject: string; status: TicketStatus; updatedAt: string; customer: string }[];
  recentCustomers: { id: string; name: string | null; email: string; createdAt: string; emailVerified: boolean }[];
}

interface AdminDashboardProps { adminEmail: string; mfaEnabled: boolean }

const statusLabels: Record<TicketStatus, string> = { OPEN: "Abertos", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvidos", CLOSED: "Encerrados" };
const statusSingular: Record<TicketStatus, string> = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido", CLOSED: "Encerrado" };

function formatPlanPrice(priceInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceInCents / 100);
}

function planIntervalLabel(interval: Plan["interval"]) {
  return { MONTHLY: "mês", YEARLY: "ano", ONCE: "pagamento único" }[interval];
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dayLabel(day: string, style: "short" | "long" = "short") {
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", style === "short" ? { day: "2-digit", month: "short" } : { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

function relativeTime(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

async function apiError(response: Response) {
  const body = await response.text().catch(() => "");
  let payload: { message?: string | string[] } | null = null;
  try { payload = body ? JSON.parse(body) as { message?: string | string[] } : null; } catch {}
  return Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? "Não foi possível concluir a operação.";
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) throw new Error("O servidor retornou uma resposta vazia. Tente novamente.");
  try { return JSON.parse(body) as T; }
  catch { throw new Error("O servidor retornou dados inválidos. Tente novamente."); }
}

const viewContent: Record<DashboardView, { kicker: string; title: ReactNode; plain: string; description: string }> = {
  overview: { kicker: "Central de operações", title: <>Bom ver você <span>de novo.</span></>, plain: "Visão geral", description: "Clientes, atendimento e planos da Orange em tempo real." },
  support: { kicker: "Atendimento", title: <>Fila de <span>atendimento.</span></>, plain: "Atendimento", description: "Responda os clientes e acompanhe cada solicitação até o fim." },
  customers: { kicker: "Relacionamento", title: <>Quem bebe <span>Orange.</span></>, plain: "Clientes", description: "Consulte, filtre e atualize os cadastros." },
  plans: { kicker: "Catálogo", title: <>Planos <span>e assinaturas.</span></>, plain: "Planos", description: "Crie, edite, pause ou remova os planos oferecidos." },
  broadcasts: { kicker: "Comunicados", title: <>Fale com <span>todo mundo.</span></>, plain: "Comunicados", description: "Escreva um e-mail, escolha categoria e layout e envie para todos os clientes." },
  security: { kicker: "Proteção da conta", title: <>Acesso <span>seguro.</span></>, plain: "Segurança", description: "Proteja o acesso à sua conta administrativa." },
  machines: { kicker: "Em breve", title: <>Máquinas <span>conectadas.</span></>, plain: "Máquinas", description: "Estrutura pronta para os refrigeradores da operação." },
  connection: { kicker: "Em breve", title: <>Integrações <span>do sistema.</span></>, plain: "Integrações", description: "Prepare a conexão com o sistema da sua operação." },
};

export function AdminDashboard({ adminEmail, mfaEnabled }: AdminDashboardProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [darkMode, setDarkMode] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [removingPlan, setRemovingPlan] = useState<Plan | null>(null);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const heading = viewContent[activeView];

  const showNotice = useCallback((message: string, isError = false) => {
    setNotice(message);
    setNoticeError(isError);
  }, []);

  // Mesmo tema do site: a escolha fica salva em "orange-tema" e vale nas duas páginas.
  useEffect(() => {
    try { if (localStorage.getItem("orange-tema") === "claro") setDarkMode(false); } catch {}
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    try { localStorage.setItem("orange-tema", next ? "escuro" : "claro"); } catch {}
  }

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const response = await apiFetch("/api/admin/overview", { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response));
      setOverview(await responseJson<OverviewData>(response));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível carregar o resumo.", true);
    } finally {
      setOverviewLoading(false);
    }
  }, [showNotice]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  useEffect(() => {
    let active = true;
    apiFetch("/api/admin/plans", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiError(response));
        return responseJson<Plan[]>(response);
      })
      .then((data) => { if (active) setPlans(data); })
      .catch((error: unknown) => {
        if (active) showNotice(error instanceof Error ? error.message : "Não foi possível carregar os planos.", true);
      })
      .finally(() => { if (active) setPlansLoading(false); });
    return () => { active = false; };
  }, [showNotice]);

  function navigate(view: DashboardView) {
    setActiveView(view);
    setNotice("");
    if (view === "overview") void loadOverview();
    window.scrollTo({ top: 0 });
  }

  function openConnection(slot?: number) {
    setSelectedSlot(slot ?? null);
    setConnectionModalOpen(true);
  }

  function openPlanModal(plan: Plan | null = null) {
    setEditingPlan(plan);
    setPlanModalOpen(true);
  }

  function closePlanModal() {
    setPlanModalOpen(false);
    setEditingPlan(null);
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("plan-name") ?? "").trim();
    const price = Number(String(form.get("plan-price") ?? "").replace(",", "."));
    const interval = String(form.get("plan-interval") ?? "");
    if (!name || !Number.isFinite(price) || price < 0 || !["MONTHLY", "YEARLY", "ONCE"].includes(interval)) return;

    setSavingPlan(true);
    try {
      const response = await apiFetch(editingPlan ? `/api/admin/plans/${editingPlan.id}` : "/api/admin/plans", {
        method: editingPlan ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, priceInCents: Math.round(price * 100), interval }),
      });
      if (!response.ok) {
        showNotice(await apiError(response), true);
        return;
      }
      const savedPlan = await responseJson<Plan>(response);
      setPlans((current) => editingPlan
        ? current.map((plan) => plan.id === savedPlan.id ? savedPlan : plan)
        : [savedPlan, ...current]);
      showNotice(editingPlan ? "Plano atualizado." : "Plano criado.");
      closePlanModal();
      formElement.reset();
    } catch {
      showNotice("Não foi possível conectar ao servidor. Tente novamente.", true);
    } finally {
      setSavingPlan(false);
    }
  }

  async function togglePlan(plan: Plan) {
    try {
      const response = await apiFetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !plan.active }),
      });
      if (!response.ok) {
        showNotice(await apiError(response), true);
        return;
      }
      const saved = await responseJson<Plan>(response);
      setPlans((current) => current.map((item) => item.id === saved.id ? saved : item));
      showNotice(saved.active ? `${saved.name} voltou a ficar ativo.` : `${saved.name} foi pausado.`);
    } catch {
      showNotice("Não foi possível conectar ao servidor. Tente novamente.", true);
    }
  }

  async function removePlan() {
    if (!removingPlan) return;
    const plan = removingPlan;
    try {
      const response = await apiFetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
      if (!response.ok) {
        showNotice(await apiError(response), true);
        return;
      }
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      showNotice(`${plan.name} foi removido.`);
    } catch {
      showNotice("Não foi possível conectar ao servidor. Tente novamente.", true);
    } finally {
      setRemovingPlan(null);
    }
  }

  async function logout() {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch {}
    router.replace("/login");
    router.refresh();
  }

  function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectionModalOpen(false);
    showNotice("A conexão está preparada na interface. Nenhum dado foi enviado ou salvo.");
  }

  const pending = overview ? overview.tickets.OPEN + overview.tickets.IN_PROGRESS : 0;

  return (
    <div className={`app-shell ${darkMode ? "theme-dark" : "theme-light"}`}>
      <Sidebar activeView={activeView} onNavigate={navigate} onLogout={logout} badges={{ support: pending }} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>ORANGE</span><span className="breadcrumb-separator">/</span><strong>{heading.plain}</strong></div>
          <div className="topbar-actions">
            <button type="button" className="icon-button theme-toggle" aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"} title={darkMode ? "Tema claro" : "Tema escuro"} onClick={toggleTheme}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <span className="topbar-divider" />
            <span className="admin-identity"><span className="admin-label">ADMIN</span><span className="admin-email">{adminEmail}</span></span>
            <span className="admin-avatar" aria-hidden="true">{adminEmail.slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" />{heading.kicker}</p>
              <h1>{heading.title}</h1>
              <p className="muted-copy">{heading.description}</p>
            </div>
            {activeView === "overview" && <button type="button" className="secondary-button" onClick={() => void loadOverview()} disabled={overviewLoading}><RefreshCw size={16} className={overviewLoading ? "customer-refresh-spinning" : ""} /> Atualizar</button>}
            {activeView === "plans" && <button type="button" className="primary-button" onClick={() => openPlanModal()}><Plus size={17} /> Criar plano</button>}
          </div>
          {notice && <div className={`notice-bar ${noticeError ? "operation-error" : ""}`} role={noticeError ? "alert" : "status"}>{noticeError ? <CircleHelp size={16} /> : <Check size={16} />}<span>{notice}</span><button type="button" className="icon-button" aria-label="Fechar aviso" onClick={() => showNotice("")}><X size={16} /></button></div>}
          {activeView === "overview" && <Overview data={overview} loading={overviewLoading} onNavigate={navigate} mfaEnabled={mfaEnabled} />}
          {activeView === "machines" && <Machines onOpenSlot={openConnection} />}
          {activeView === "support" && <AdminSupport />}
          {activeView === "security" && <AdminMfaSettings initiallyEnabled={mfaEnabled} />}
          {activeView === "plans" && <Plans plans={plans} loading={plansLoading} onCreate={() => openPlanModal()} onEdit={openPlanModal} onToggle={togglePlan} onRemove={setRemovingPlan} />}
          {activeView === "customers" && <AdminCustomers />}
          {activeView === "broadcasts" && <AdminBroadcasts />}
          {activeView === "connection" && <Connection onConnect={openConnection} />}
          <footer className="page-footer"><span>ORANGE <i>·</i> PAINEL ADMINISTRATIVO</span><span>O LADO MAIS VIVO DA SUA ROTINA <span className="footer-dot" /></span></footer>
        </div>
      </main>

      {planModalOpen && <Modal title={editingPlan ? "Editar plano" : "Novo plano"} onClose={closePlanModal}><form className="modal-form" onSubmit={savePlan}>
        <label htmlFor="plan-name">Nome do plano</label><input id="plan-name" name="plan-name" placeholder="Ex.: Orange Club" defaultValue={editingPlan?.name ?? ""} minLength={2} maxLength={120} required />
        <div className="form-row"><div><label htmlFor="plan-price">Valor (R$)</label><input id="plan-price" name="plan-price" type="number" min="0" max="1000000" step="0.01" placeholder="0,00" defaultValue={editingPlan ? (editingPlan.priceInCents / 100).toFixed(2) : ""} required /></div><div><label htmlFor="plan-interval">Cobrança</label><select id="plan-interval" name="plan-interval" defaultValue={editingPlan?.interval ?? "MONTHLY"}><option value="MONTHLY">Mensal</option><option value="YEARLY">Anual</option><option value="ONCE">Única</option></select></div></div>
        <p className="form-footnote">As alterações são salvas no banco de dados.</p>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={closePlanModal}>Cancelar</button><button className="primary-button" type="submit" disabled={savingPlan}>{savingPlan ? "Salvando…" : <>{editingPlan ? <Check size={16} /> : <Plus size={16} />}{editingPlan ? "Salvar alterações" : "Adicionar plano"}</>}</button></div>
      </form></Modal>}

      {removingPlan && <Modal title="Remover plano" onClose={() => setRemovingPlan(null)}>
        <p className="modal-copy">O plano <strong>{removingPlan.name}</strong> será apagado do banco de dados. Se quiser só tirá-lo do ar por um tempo, use <em>Pausar</em>.</p>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setRemovingPlan(null)}>Cancelar</button><button type="button" className="danger-button" onClick={() => void removePlan()}><Trash2 size={16} /> Remover plano</button></div>
      </Modal>}

      {connectionModalOpen && <Modal title={selectedSlot ? `Conectar slot ${pad(selectedSlot)}` : "Conectar sistema"} onClose={() => setConnectionModalOpen(false)}><form className="modal-form" onSubmit={saveConnection}>
        <label htmlFor="connection-url">Endereço do sistema</label><input id="connection-url" name="url" type="url" placeholder="https://sistema.empresa.com" required />
        <label htmlFor="connection-type">Tipo de integração</label><select id="connection-type" name="type"><option>API REST</option><option>Webhook</option><option>Outro</option></select>
        <p className="form-footnote">Prévia: a interface não transmite nem armazena dados. A conexão real depende da API do sistema.</p>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConnectionModalOpen(false)}>Cancelar</button><button className="primary-button" type="submit"><Cable size={16} /> Preparar conexão</button></div>
      </form></Modal>}
    </div>
  );
}

function Overview({ data, loading, onNavigate, mfaEnabled }: { data: OverviewData | null; loading: boolean; onNavigate: (view: DashboardView) => void; mfaEnabled: boolean }) {
  if (!data) {
    return loading
      ? <div className="content-panel operation-empty"><RefreshCw size={21} className="customer-refresh-spinning" /><strong>Carregando o resumo</strong><span>Buscando clientes, chamados e planos.</span></div>
      : <div className="content-panel operation-empty"><CircleHelp size={22} /><strong>Resumo indisponível</strong><span>Não foi possível falar com o servidor. Tente atualizar.</span></div>;
  }
  const { customers, tickets, plans } = data;
  const open = tickets.OPEN + tickets.IN_PROGRESS;
  const done = tickets.RESOLVED + tickets.CLOSED;
  const totalTickets = open + done;

  return <>
    {!mfaEnabled && <button type="button" className="alert-strip" onClick={() => onNavigate("security")}><ShieldCheck size={18} /><span><strong>Ative a autenticação em duas etapas.</strong> Sua conta de administrador ainda entra só com senha.</span><ArrowUpRight size={16} /></button>}
    <section className="metric-grid" aria-label="Indicadores">
      <Metric featured icon={<UsersRound size={19} />} label="Clientes" value={pad(customers.total)} note={`+${customers.last30} nos últimos 30 dias`} onClick={() => onNavigate("customers")} />
      <Metric icon={<MessageSquareText size={19} />} label="Chamados em aberto" value={pad(open)} note={tickets.awaitingReply ? `${tickets.awaitingReply} esperando resposta da equipe` : "Nenhum cliente esperando"} onClick={() => onNavigate("support")} />
      <Metric icon={<Check size={19} />} label="Chamados resolvidos" value={pad(done)} note={totalTickets ? `${Math.round((done / totalTickets) * 100)}% de todos os chamados` : "Nenhum chamado ainda"} onClick={() => onNavigate("support")} />
      <Metric icon={<Activity size={19} />} label="Planos ativos" value={pad(plans.active)} note={plans.total ? `${plans.total} cadastrados no total` : "Nenhum plano cadastrado"} onClick={() => onNavigate("plans")} />
    </section>

    <section className="overview-grid">
      <SignupChart signups={data.signups} last7={customers.last7} />
      <div className="content-panel">
        <div className="panel-heading"><div><p className="panel-kicker">Atendimento</p><h2>Chamados por status</h2></div><button type="button" className="icon-button subtle-icon" aria-label="Abrir atendimento" title="Abrir atendimento" onClick={() => onNavigate("support")}><ArrowUpRight size={17} /></button></div>
        <div className="breakdown">
          {(Object.keys(statusLabels) as TicketStatus[]).map((status) => (
            <div className="breakdown-row" key={status}>
              <span className="breakdown-label">{statusLabels[status]}</span>
              <span className="breakdown-track"><span style={{ width: totalTickets ? `${(tickets[status] / totalTickets) * 100}%` : "0%" }} /></span>
              <strong className="breakdown-value">{tickets[status]}</strong>
            </div>
          ))}
        </div>
        <p className="panel-foot">{totalTickets ? `${totalTickets} ${totalTickets === 1 ? "chamado" : "chamados"} no total` : "Os chamados abertos pelos clientes aparecem aqui."}</p>
      </div>
    </section>

    <section className="overview-grid overview-grid-even">
      <div className="content-panel">
        <div className="panel-heading"><div><p className="panel-kicker">Últimos movimentos</p><h2>Chamados recentes</h2></div><button type="button" className="text-action" onClick={() => onNavigate("support")}>Ver todos <ArrowUpRight size={15} /></button></div>
        {data.recentTickets.length === 0
          ? <p className="panel-empty">Nenhum chamado por enquanto.</p>
          : <ul className="recent-list">{data.recentTickets.map((ticket) => (
            <li key={ticket.id}><button type="button" onClick={() => onNavigate("support")}>
              <span className="recent-icon"><MessageSquareText size={16} /></span>
              <span className="recent-main"><strong>{ticket.subject}</strong><small>{ticket.customer} · {relativeTime(ticket.updatedAt)}</small></span>
              <span className={`operation-status operation-status-${ticket.status.toLowerCase()}`}>{statusSingular[ticket.status]}</span>
            </button></li>
          ))}</ul>}
      </div>
      <div className="content-panel">
        <div className="panel-heading"><div><p className="panel-kicker">Novos cadastros</p><h2>Clientes recentes</h2></div><button type="button" className="text-action" onClick={() => onNavigate("customers")}>Ver todos <ArrowUpRight size={15} /></button></div>
        {data.recentCustomers.length === 0
          ? <p className="panel-empty">Os clientes que criarem conta aparecerão aqui.</p>
          : <ul className="recent-list">{data.recentCustomers.map((customer) => (
            <li key={customer.id}><button type="button" onClick={() => onNavigate("customers")}>
              <span className="recent-icon"><UserRound size={16} /></span>
              <span className="recent-main"><strong>{customer.name || customer.email}</strong><small>{customer.name ? `${customer.email} · ` : ""}{relativeTime(customer.createdAt)}</small></span>
              <span className={`operation-status ${customer.emailVerified ? "operation-status-resolved" : "operation-status-open"}`}>{customer.emailVerified ? "Confirmado" : "Pendente"}</span>
            </button></li>
          ))}</ul>}
        <div className="account-health">
          <HealthStat icon={<MailCheck size={15} />} label="E-mail confirmado" value={customers.verified} total={customers.total} />
          <HealthStat icon={<GoogleMark />} label="Entram com Google" value={customers.google} total={customers.total} />
          <HealthStat icon={<ShieldCheck size={15} />} label="Com duas etapas" value={customers.mfa} total={customers.total} />
        </div>
      </div>
    </section>
  </>;
}

function GoogleMark() {
  return <svg viewBox="0 0 48 48" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M43.6 20.5H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}

function HealthStat({ icon, label, value, total }: { icon: ReactNode; label: string; value: number; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div className="health-stat"><span className="health-icon">{icon}</span><span className="health-label">{label}</span><span className="breakdown-track"><span style={{ width: `${percent}%` }} /></span><strong>{percent}%</strong></div>;
}

// Cadastros por dia (uma série, uma cor): título nomeia a série, sem legenda; dica ao passar o mouse
// ou focar a barra; tabela equivalente para leitores de tela e para conferir os números.
function SignupChart({ signups, last7 }: { signups: OverviewData["signups"]; last7: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = signups.reduce((sum, item) => sum + item.total, 0);
  const max = Math.max(1, ...signups.map((item) => item.total));
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const active = hovered === null ? null : signups[hovered];

  return <div className="content-panel chart-panel">
    <div className="panel-heading">
      <div><p className="panel-kicker">Crescimento</p><h2>Novos clientes por dia</h2></div>
      <div className="chart-headline"><strong>{total}</strong><span>em 30 dias · {last7} na última semana</span></div>
    </div>
    <div className="bar-chart" onMouseLeave={() => setHovered(null)}>
      <div className="bar-grid" aria-hidden="true">{[top, top / 2, 0].map((value) => <span key={value}><i>{Number.isInteger(value) ? value : value.toFixed(1)}</i></span>)}</div>
      <div className="bar-columns">
        {signups.map((item, index) => (
          <button
            type="button"
            key={item.day}
            className={`bar-column ${hovered === index ? "bar-column-active" : ""}`}
            aria-label={`${dayLabel(item.day, "long")}: ${item.total} ${item.total === 1 ? "cadastro" : "cadastros"}`}
            onMouseEnter={() => setHovered(index)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
          >
            <span className="bar" style={{ height: item.total ? `${(item.total / top) * 100}%` : "0" }} />
          </button>
        ))}
      </div>
      {active && hovered !== null && <div className="bar-tooltip" style={{ left: `${((hovered + .5) / signups.length) * 100}%` }} role="status">
        <span>{dayLabel(active.day, "long")}</span><strong>{active.total} {active.total === 1 ? "cadastro" : "cadastros"}</strong>
      </div>}
    </div>
    <div className="bar-axis" aria-hidden="true"><span>{dayLabel(signups[0].day)}</span><span>{dayLabel(signups[14].day)}</span><span>Hoje</span></div>
    <details className="chart-table">
      <summary>Ver os números em tabela</summary>
      <table><thead><tr><th scope="col">Dia</th><th scope="col">Cadastros</th></tr></thead><tbody>{[...signups].reverse().map((item) => <tr key={item.day}><td>{dayLabel(item.day)}</td><td>{item.total}</td></tr>)}</tbody></table>
    </details>
  </div>;
}

function Metric({ icon, label, value, note, featured, onClick }: { icon: ReactNode; label: string; value: string; note: string; featured?: boolean; onClick?: () => void }) {
  return <button type="button" className={`metric-card ${featured ? "metric-featured" : ""}`} onClick={onClick}>
    <span className="metric-top"><span className="metric-icon">{icon}</span><ArrowUpRight className="metric-arrow" size={16} /></span>
    <span className="metric-label">{label}</span>
    <strong className="metric-value">{value}</strong>
    <span className="metric-note">{note}</span>
  </button>;
}

function Machines({ onOpenSlot }: { onOpenSlot: (slot: number) => void }) {
  return <section className="content-panel full-panel"><div className="panel-heading"><div><p className="panel-kicker">Equipamentos</p><h2>Slots disponíveis</h2></div><span className="quiet-count">PRÉVIA · 04 SLOTS</span></div><p className="section-intro">Estrutura pronta para receber os refrigeradores. O status será atualizado quando a integração existir.</p><div className="machine-list">{[1, 2, 3, 4].map((slot) => <article className="machine-row" key={slot}><span className="machine-icon"><Snowflake size={21} /></span><div className="machine-info"><strong>Refrigerador <span>·</span> Slot {pad(slot)}</strong><span>Equipamento ainda não vinculado</span></div><span className="status-pill"><span className="status-dot" />Aguardando conexão</span><button type="button" className="secondary-button compact-button" onClick={() => onOpenSlot(slot)}><Cable size={15} /> Vincular</button></article>)}</div></section>;
}

function Plans({ plans, loading, onCreate, onEdit, onToggle, onRemove }: { plans: Plan[]; loading: boolean; onCreate: () => void; onEdit: (plan: Plan) => void; onToggle: (plan: Plan) => void; onRemove: (plan: Plan) => void }) {
  if (loading) return <EmptyState icon={<RefreshCw size={22} className="customer-refresh-spinning" />} title="Carregando planos" description="Buscando os dados salvos no banco." />;
  if (plans.length === 0) return <EmptyState icon={<Activity size={22} />} title="Nenhum plano cadastrado" description="Crie o primeiro plano. Ele fica salvo no banco de dados." action={<button type="button" className="primary-button" onClick={onCreate}><Plus size={16} /> Criar primeiro plano</button>} />;
  return <section className="admin-plans-grid">{plans.map((plan) => (
    <article className={`admin-plan-card ${plan.active ? "" : "admin-plan-paused"}`} key={plan.id}>
      <div className="admin-plan-top"><span>{plan.interval === "MONTHLY" ? "Assinatura mensal" : plan.interval === "YEARLY" ? "Assinatura anual" : "Compra avulsa"}</span><span className={`operation-status ${plan.active ? "operation-status-resolved" : ""}`}>{plan.active ? "Ativo" : "Pausado"}</span></div>
      <h3>{plan.name}</h3>
      <p className="admin-plan-price">{formatPlanPrice(plan.priceInCents)}<small> / {planIntervalLabel(plan.interval)}</small></p>
      <div className="plan-divider" />
      <div className="admin-plan-actions">
        <button type="button" className="secondary-button compact-button" onClick={() => onEdit(plan)}><Settings2 size={15} /> Editar</button>
        <button type="button" className="secondary-button compact-button" onClick={() => onToggle(plan)}>{plan.active ? "Pausar" : "Reativar"}</button>
        <button type="button" className="icon-button plan-remove" aria-label={`Remover ${plan.name}`} title={`Remover ${plan.name}`} onClick={() => onRemove(plan)}><Trash2 size={15} /></button>
      </div>
    </article>
  ))}</section>;
}

function Connection({ onConnect }: { onConnect: () => void }) {
  return <div className="connection-page"><section className="content-panel connection-status-panel"><div className="connection-status-top"><div className="metric-icon"><Cable size={20} /></div><span className="status-pill"><span className="status-dot" />Não conectado</span></div><p className="panel-kicker">Status da integração</p><h2>Conecte os dados da sua operação</h2><p>Quando o sistema da operação estiver integrado, faturamento e equipamentos poderão aparecer neste painel ao lado dos clientes e chamados.</p><button type="button" className="primary-button" onClick={onConnect}><Cable size={17} /> Configurar conexão</button></section><section className="content-panel integration-list"><p className="panel-kicker">Disponível para configuração</p><div className="integration-row"><span className="metric-icon"><Activity size={18} /></span><div><strong>API do sistema</strong><span>Conexão via API REST ou webhook</span></div><span className="integration-tag">Aguardando</span></div><div className="integration-row"><span className="metric-icon"><ShieldCheck size={18} /></span><div><strong>Credenciais</strong><span>Definidas no servidor, nunca no navegador</span></div><span className="integration-tag">Pendente</span></div></section></div>;
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="content-panel empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><p className="panel-kicker">Orange</p><h2 id="modal-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>{children}</section></div>;
}
