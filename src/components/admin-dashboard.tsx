"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowUpRight, Cable, Check, ChevronDown, CircleDollarSign,
  CircleHelp, Filter, History, Moon, Plus, Search, Settings2, ShieldCheck,
  Snowflake, Sun, Ticket, Trash2, Wifi, X,
} from "lucide-react";
import { Sidebar, type DashboardView } from "@/components/ui/sidebar";

interface Plan {
  name: string;
  price: string;
  interval: string;
}

const viewContent: Record<DashboardView, { title: string; description: string }> = {
  overview: { title: "Visão geral", description: "Um resumo da sua operação em um só lugar." },
  machines: { title: "Máquinas", description: "Slots prontos para conectar seus equipamentos." },
  support: { title: "Atendimento", description: "Acompanhe solicitações de suporte dos clientes." },
  plans: { title: "Planos", description: "Gerencie os planos disponíveis para seus clientes." },
  customers: { title: "Clientes", description: "Histórico de compras e assinaturas por cliente." },
  connection: { title: "Integrações", description: "Prepare a conexão com o sistema da sua operação." },
};

export function AdminDashboard() {
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [darkMode, setDarkMode] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const heading = viewContent[activeView];

  function openConnection(slot?: number) {
    setSelectedSlot(slot ?? null);
    setConnectionModalOpen(true);
  }

  function openPlanModal(index: number | null = null) {
    setEditingPlanIndex(index);
    setPlanModalOpen(true);
  }

  function closePlanModal() {
    setPlanModalOpen(false);
    setEditingPlanIndex(null);
  }

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("plan-name") ?? "").trim();
    const price = String(form.get("plan-price") ?? "").trim();
    const interval = String(form.get("plan-interval") ?? "");
    if (!name || !price) return;
    if (editingPlanIndex === null) {
      setPlans((current) => [...current, { name, price, interval }]);
      setNotice("Plano adicionado apenas nesta prévia local.");
    } else {
      setPlans((current) => current.map((plan, index) => index === editingPlanIndex ? { name, price, interval } : plan));
      setNotice("Plano atualizado apenas nesta prévia local.");
    }
    closePlanModal();
    event.currentTarget.reset();
  }

  function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectionModalOpen(false);
    setNotice("A conexão está preparada na interface. Nenhum dado foi enviado ou salvo.");
  }

  return (
    <div className={`app-shell ${darkMode ? "theme-dark" : "theme-light"}`}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>BEBA ORANGE</span><span className="breadcrumb-separator">/</span><strong>{heading.title}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button theme-toggle" aria-label={darkMode ? "Ativar tema claro" : "Ativar modo escuro absoluto"} title={darkMode ? "Tema claro" : "Modo escuro absoluto"} onClick={() => setDarkMode(!darkMode)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <span className="topbar-divider" />
            <span className="admin-label">ADMIN</span>
            <span className="admin-avatar" aria-label="Administrador">BO</span>
          </div>
        </header>
        <div className="page-wrap">
          <div className="page-heading">
            <div><p className="eyebrow">CENTRAL DE OPERAÇÕES</p><h1>{heading.title}</h1><p className="muted-copy">{heading.description}</p></div>
            {activeView === "overview" && <button className="primary-button" onClick={() => setActiveView("connection")}><Cable size={17} /> Conectar sistema</button>}
            {activeView === "plans" && <button className="primary-button" onClick={() => openPlanModal()}><Plus size={17} /> Criar plano</button>}
          </div>
          {notice && <div className="notice-bar" role="status"><Check size={16} /><span>{notice}</span><button className="icon-button" aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}
          {activeView === "overview" && <Overview plans={plans} onConnect={() => setActiveView("connection")} onOpenSlot={openConnection} onViewMachines={() => setActiveView("machines")} />}
          {activeView === "machines" && <Machines onOpenSlot={openConnection} />}
          {activeView === "support" && <Support />}
          {activeView === "plans" && <Plans plans={plans} onCreate={() => openPlanModal()} onEdit={openPlanModal} onRemove={(index) => { setPlans((current) => current.filter((_, itemIndex) => itemIndex !== index)); setNotice("Plano removido desta prévia local."); }} />}
          {activeView === "customers" && <Customers />}
          {activeView === "connection" && <Connection onConnect={openConnection} />}
          <footer className="page-footer"><span>BEBA ORANGE <i>·</i> PAINEL ADMINISTRATIVO</span><span>PRÉVIA DE INTERFACE <span className="footer-dot" /></span></footer>
        </div>
      </main>

      {planModalOpen && <Modal title={editingPlanIndex === null ? "Novo plano" : "Editar plano"} onClose={closePlanModal}><form className="modal-form" onSubmit={savePlan}>
        <label htmlFor="plan-name">Nome do plano</label><input id="plan-name" name="plan-name" placeholder="Ex.: Essencial" defaultValue={editingPlanIndex === null ? "" : plans[editingPlanIndex]?.name} required />
        <div className="form-row"><div><label htmlFor="plan-price">Valor (R$)</label><input id="plan-price" name="plan-price" type="number" min="0" step="0.01" placeholder="0,00" defaultValue={editingPlanIndex === null ? "" : plans[editingPlanIndex]?.price} required /></div><div><label htmlFor="plan-interval">Cobrança</label><select id="plan-interval" name="plan-interval" defaultValue={editingPlanIndex === null ? "Mensal" : plans[editingPlanIndex]?.interval}><option value="Mensal">Mensal</option><option value="Anual">Anual</option><option value="Única">Única</option></select></div></div>
        <p className="form-footnote">Este plano ficará salvo apenas nesta prévia. A persistência será ligada ao sistema depois.</p>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={closePlanModal}>Cancelar</button><button className="primary-button" type="submit">{editingPlanIndex === null ? <Plus size={16} /> : <Check size={16} />}{editingPlanIndex === null ? "Adicionar plano" : "Salvar alterações"}</button></div>
      </form></Modal>}

      {connectionModalOpen && <Modal title={selectedSlot ? `Conectar slot ${String(selectedSlot).padStart(2, "0")}` : "Conectar sistema"} onClose={() => setConnectionModalOpen(false)}><form className="modal-form" onSubmit={saveConnection}>
        <label htmlFor="connection-url">Endereço do sistema</label><input id="connection-url" name="url" type="url" placeholder="https://sistema.empresa.com" required />
        <label htmlFor="connection-type">Tipo de integração</label><select id="connection-type" name="type"><option>API REST</option><option>Webhook</option><option>Outro</option></select>
        <label htmlFor="connection-key">Chave de acesso</label><input id="connection-key" name="key" type="password" placeholder="Será configurada com segurança no backend" autoComplete="off" />
        <p className="form-footnote">A interface não transmite nem armazena credenciais. A conexão real depende da API do sistema.</p>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConnectionModalOpen(false)}>Cancelar</button><button className="primary-button" type="submit"><Cable size={16} /> Preparar conexão</button></div>
      </form></Modal>}
    </div>
  );
}

function Overview({ plans, onConnect, onOpenSlot, onViewMachines }: { plans: Plan[]; onConnect: () => void; onOpenSlot: (slot: number) => void; onViewMachines: () => void }) {
  return <>
    <section className="metric-grid" aria-label="Indicadores da operação">
      <Metric icon={<CircleDollarSign size={19} />} label="Faturamento bruto" value="—" note="Aguardando conexão do sistema" tone="orange" />
      <Metric icon={<Snowflake size={19} />} label="Máquinas" value="—" note="Nenhum equipamento conectado" />
      <Metric icon={<Ticket size={19} />} label="Atendimento" value="—" note="Nenhuma fila integrada" />
      <Metric icon={<Activity size={19} />} label="Planos ativos" value={plans.length ? String(plans.length).padStart(2, "0") : "—"} note={plans.length ? "Criados nesta prévia" : "Nenhum plano cadastrado"} />
    </section>
    <section className="overview-grid">
      <div className="content-panel revenue-panel">
        <div className="panel-heading"><div><p className="panel-kicker">FINANCEIRO</p><h2>Faturamento bruto</h2></div><button className="quiet-select" disabled>Este mês <ChevronDown size={15} /></button></div>
        <div className="revenue-blank"><div className="chart-lines"><span /><span /><span /><span /></div><div className="chart-empty"><span className="chart-empty-icon"><CircleDollarSign size={20} /></span><strong>Sem dados de faturamento</strong><span>Conecte o sistema para visualizar suas receitas.</span><button className="text-action" onClick={onConnect}>Configurar conexão <ArrowUpRight size={15} /></button></div><div className="chart-axis"><span>01</span><span>10</span><span>20</span><span>30</span></div></div>
      </div>
      <div className="content-panel machine-panel">
        <div className="panel-heading"><div><p className="panel-kicker">EQUIPAMENTOS</p><h2>Slots de máquinas</h2></div><button className="icon-button subtle-icon" aria-label="Ver máquinas" title="Ver máquinas" onClick={onViewMachines}><ArrowUpRight size={17} /></button></div>
        <div className="slot-mini-list">{[1, 2, 3].map((slot) => <button className="slot-mini" key={slot} onClick={() => onOpenSlot(slot)}><span className="slot-mini-icon"><Snowflake size={17} /></span><span className="slot-mini-name"><strong>Refrigerador</strong><small>Slot {String(slot).padStart(2, "0")}</small></span><span className="status-pill"><span className="status-dot status-muted" />Aguardando</span></button>)}</div>
        <button className="panel-link" onClick={onConnect}>Vincular equipamento <ArrowUpRight size={15} /></button>
      </div>
    </section>
    <section className="connection-strip"><div className="connection-symbol"><Wifi size={20} /></div><div className="connection-message"><strong>Seu sistema ainda não está conectado</strong><span>Os indicadores serão preenchidos quando a integração estiver ativa.</span></div><button className="secondary-button" onClick={onConnect}>Configurar integração <ArrowUpRight size={15} /></button></section>
  </>;
}

function Metric({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone?: "orange" }) {
  return <article className="metric-card"><div className={`metric-icon ${tone === "orange" ? "metric-icon-orange" : ""}`}>{icon}</div><p className="metric-label">{label}</p><strong className="metric-value">{value}</strong><span className="metric-note"><span className="status-dot status-muted" />{note}</span></article>;
}

function Machines({ onOpenSlot }: { onOpenSlot: (slot: number) => void }) {
  return <section className="content-panel full-panel"><div className="panel-heading"><div><p className="panel-kicker">EQUIPAMENTOS</p><h2>Slots disponíveis</h2></div><span className="quiet-count">04 SLOTS</span></div><p className="section-intro">Estrutura pronta para receber os refrigeradores. O status será atualizado pela integração.</p><div className="machine-list">{[1, 2, 3, 4].map((slot) => <article className="machine-row" key={slot}><span className="machine-icon"><Snowflake size={21} /></span><div className="machine-info"><strong>Refrigerador <span>·</span> Slot {String(slot).padStart(2, "0")}</strong><span>Equipamento ainda não vinculado</span></div><span className="status-pill"><span className="status-dot status-muted" />Aguardando conexão</span><button className="secondary-button compact-button" onClick={() => onOpenSlot(slot)}><Cable size={15} /> Vincular</button></article>)}</div></section>;
}

function Support() {
  return <><section className="support-toolbar"><div className="filter-tabs"><button className="filter-tab filter-tab-active"><CircleHelp size={15} /> Todos <span>—</span></button><button className="filter-tab" disabled>Em aberto <span>—</span></button><button className="filter-tab" disabled>Resolvidos <span>—</span></button></div><button className="secondary-button" disabled><Filter size={15} /> Filtrar</button></section><EmptyState icon={<Ticket size={22} />} title="Nenhuma solicitação por aqui" description="As conversas de atendimento aparecerão quando o sistema estiver conectado." /></>;
}

function Plans({ plans, onCreate, onEdit, onRemove }: { plans: Plan[]; onCreate: () => void; onEdit: (index: number) => void; onRemove: (index: number) => void }) {
  if (plans.length === 0) return <EmptyState icon={<Activity size={22} />} title="Nenhum plano cadastrado" description="Crie os planos que seus clientes poderão assinar. Eles serão salvos localmente nesta prévia." action={<button className="primary-button" onClick={onCreate}><Plus size={16} /> Criar primeiro plano</button>} />;
  return <section className="content-panel full-panel"><div className="panel-heading"><div><p className="panel-kicker">CATÁLOGO</p><h2>Planos disponíveis</h2></div><span className="quiet-count">{String(plans.length).padStart(2, "0")} PLANOS</span></div><div className="plans-grid">{plans.map((plan, index) => <article className="plan-card" key={`${plan.name}-${index}`}><span className="plan-card-icon"><Activity size={18} /></span><span className="plan-status"><span className="status-dot status-active" />Ativo nesta prévia</span><h3>{plan.name}</h3><p className="plan-price"><strong>R$ {plan.price}</strong><span> / {plan.interval.toLowerCase()}</span></p><div className="plan-divider" /><p className="plan-footnote">Plano criado localmente. Integre um backend para publicar e gerenciar assinaturas.</p><div className="plan-actions"><button className="plan-edit" onClick={() => onEdit(index)}><Settings2 size={15} /> Editar plano</button><button className="icon-button plan-remove" aria-label={`Excluir ${plan.name}`} title={`Excluir ${plan.name}`} onClick={() => onRemove(index)}><Trash2 size={15} /></button></div></article>)}</div></section>;
}

function Customers() {
  return <><section className="customer-tools"><label className="search-field"><Search size={17} /><input type="search" placeholder="Buscar cliente por nome ou e-mail" /><span>⌘ K</span></label><button className="secondary-button" disabled><Filter size={15} /> Filtros <ChevronDown size={15} /></button></section><section className="content-panel full-panel history-panel"><div className="panel-heading"><div><p className="panel-kicker">RELACIONAMENTO</p><h2>Compras e assinaturas</h2></div><button className="quiet-select" disabled>Todos os períodos <ChevronDown size={15} /></button></div><div className="table-head"><span>CLIENTE</span><span>ÚLTIMA COMPRA</span><span>ASSINATURA</span><span>VALOR</span></div><EmptyState compact icon={<History size={21} />} title="Histórico ainda vazio" description="Compras e assinaturas de cada cliente aparecerão aqui após conectar seu sistema." /></section></>;
}

function Connection({ onConnect }: { onConnect: () => void }) {
  return <div className="connection-page"><section className="connection-status-panel"><div className="connection-status-top"><div className="connection-status-icon"><Cable size={22} /></div><span className="status-pill"><span className="status-dot status-muted" />Não conectado</span></div><p className="panel-kicker">STATUS DA INTEGRAÇÃO</p><h2>Conecte os dados da sua operação</h2><p>Ao integrar o seu sistema, faturamento, equipamentos, atendimento, planos e histórico de clientes poderão aparecer neste painel.</p><button className="primary-button" onClick={onConnect}><Cable size={17} /> Configurar conexão</button></section><section className="integration-list"><p className="panel-kicker">DISPONÍVEL PARA CONFIGURAÇÃO</p><div className="integration-row"><span className="integration-icon"><Activity size={18} /></span><div><strong>API do sistema</strong><span>Conexão segura via API REST ou webhook</span></div><span className="integration-tag">Aguardando</span></div><div className="integration-row"><span className="integration-icon"><ShieldCheck size={18} /></span><div><strong>Credenciais</strong><span>Autenticação será definida na etapa de backend</span></div><span className="integration-tag">Pendente</span></div></section></div>;
}

function EmptyState({ icon, title, description, action, compact = false }: { icon: ReactNode; title: string; description: string; action?: ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "empty-state-compact" : ""}`}><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><p className="panel-kicker">BEBA ORANGE</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>{children}</section></div>;
}