"use client";

import { useState } from "react";
import {
  Activity, ArrowUpRight, Megaphone, Boxes, Cable, CircleHelp, LayoutDashboard,
  LogOut, Menu, ShieldCheck, UsersRound, X,
} from "lucide-react";
import LogoOrange from "@/components/orange/LogoOrange";

export type DashboardView = "overview" | "machines" | "support" | "plans" | "customers" | "broadcasts" | "connection" | "security";

const items: { id: DashboardView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "support", label: "Atendimento", icon: CircleHelp },
  { id: "customers", label: "Clientes", icon: UsersRound },
  { id: "broadcasts", label: "Comunicados", icon: Megaphone },
  { id: "plans", label: "Planos", icon: Activity },
  { id: "security", label: "Segurança", icon: ShieldCheck },
];

const upcoming: { id: DashboardView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "machines", label: "Máquinas", icon: Boxes },
  { id: "connection", label: "Integrações", icon: Cable },
];

interface SidebarProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onLogout: () => void;
  badges?: Partial<Record<DashboardView, number>>;
}

function Brand() {
  return (
    <a className="brand-lockup" href="/" aria-label="Orange, voltar ao site">
      <span className="brand-mark"><LogoOrange /></span>
      <span className="brand-name">Orange<small>Admin</small></span>
    </a>
  );
}

export function Sidebar({ activeView, onNavigate, onLogout, badges = {} }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(view: DashboardView) {
    onNavigate(view);
    setMobileOpen(false);
  }

  function renderItem({ id, label, icon: Icon }: (typeof items)[number], soon = false) {
    const badge = badges[id];
    return (
      <button key={id} type="button" className={`nav-link ${activeView === id ? "nav-link-active" : ""}`} onClick={() => navigate(id)} aria-current={activeView === id ? "page" : undefined}>
        <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        {soon ? <span className="nav-soon">Em breve</span> : badge ? <span className="nav-badge" aria-label={`${badge} pendentes`}>{badge > 99 ? "99+" : badge}</span> : null}
      </button>
    );
  }

  return (
    <>
      <div className="mobile-bar">
        <Brand />
        <button className="icon-button" type="button" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
      </div>
      {mobileOpen && <button className="mobile-scrim" type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button mobile-close" type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <p className="nav-caption"><span className="eyebrow-dot" />Operação</p>
        <nav className="sidebar-nav" aria-label="Navegação principal">{items.map((item) => renderItem(item))}</nav>
        <p className="nav-caption">Próximas etapas</p>
        <nav className="sidebar-nav" aria-label="Recursos em preparação">{upcoming.map((item) => renderItem(item, true))}</nav>
        <div className="sidebar-spacer" />
        <a className="nav-link" href="/"><ArrowUpRight size={18} strokeWidth={1.8} /><span>Ver o site</span></a>
        <button className="nav-link logout-link" type="button" onClick={onLogout}><LogOut size={18} strokeWidth={1.8} /><span>Sair</span></button>
      </aside>
    </>
  );
}
