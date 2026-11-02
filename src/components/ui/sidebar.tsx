"use client";

import { useState } from "react";
import {
  Activity, Boxes, Cable, ChevronRight, CircleHelp, LayoutDashboard,
  LogOut, Menu, UsersRound, X,
} from "lucide-react";

export type DashboardView = "overview" | "machines" | "support" | "plans" | "customers" | "connection";

const items: { id: DashboardView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "machines", label: "Máquinas", icon: Boxes },
  { id: "support", label: "Atendimento", icon: CircleHelp },
  { id: "plans", label: "Planos", icon: Activity },
  { id: "customers", label: "Clientes", icon: UsersRound },
];

interface SidebarProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(view: DashboardView) {
    onNavigate(view);
    setMobileOpen(false);
  }

  return (
    <>
      <div className="mobile-bar">
        <a className="brand-lockup" href="/" aria-label="Beba Orange, início"><span className="brand-mark">B</span><span>BEBA <b>ORANGE</b></span></a>
        <button className="icon-button" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
      </div>
      {mobileOpen && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <a className="brand-lockup" href="/" aria-label="Beba Orange, início"><span className="brand-mark">B</span><span>BEBA <b>ORANGE</b></span></a>
          <button className="icon-button mobile-close" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <p className="nav-caption">OPERAÇÃO</p>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${activeView === id ? "nav-link-active" : ""}`} onClick={() => navigate(id)} aria-current={activeView === id ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{activeView === id && <ChevronRight className="nav-chevron" size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-connection"><span className="status-dot status-muted" /><span>Sistema não conectado</span></div>
        <button className={`nav-link ${activeView === "connection" ? "nav-link-active" : ""}`} onClick={() => navigate("connection")}><Cable size={18} strokeWidth={1.8} /><span>Integrações</span></button>
        <a className="nav-link logout-link" href="/login"><LogOut size={18} strokeWidth={1.8} /><span>Sair</span></a>
        <div className="sidebar-version">BEBA ORANGE <span>ADMIN · 0.1</span></div>
      </aside>
    </>
  );
}