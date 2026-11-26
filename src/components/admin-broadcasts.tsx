"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, CircleHelp, Monitor, Pause, Play, RefreshCw, Send, Smartphone, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Category = "NEWS" | "PROMO" | "NOTICE" | "UPDATE";
type Layout = "HIGHLIGHT" | "LETTER" | "OFFER";
type Status = "SENDING" | "SENT" | "CANCELLED";

interface Draft {
  subject: string; category: Category; layout: Layout; headline: string; highlight: string;
  body: string; imageUrl: string; ctaLabel: string; ctaUrl: string;
}

interface Broadcast {
  id: string; subject: string; category: Category; layout: Layout; headline: string; status: Status;
  total: number; sent: number; failed: number; pending: number; createdAt: string; finishedAt: string | null; paused?: boolean;
}

interface Listing { audience: number; unsubscribed: number; smtpReady: boolean; broadcasts: Broadcast[] }

const categories: { id: Category; label: string; hint: string }[] = [
  { id: "NEWS", label: "Novidade", hint: "Lançamentos e notícias" },
  { id: "PROMO", label: "Promoção", hint: "Ofertas e cupons" },
  { id: "NOTICE", label: "Aviso", hint: "Algo importante" },
  { id: "UPDATE", label: "Atualização", hint: "Mudanças no serviço" },
];

const layouts: { id: Layout; label: string; hint: string }[] = [
  { id: "HIGHLIGHT", label: "Destaque", hint: "Faixa laranja com título grande" },
  { id: "LETTER", label: "Carta", hint: "Texto limpo, como uma carta" },
  { id: "OFFER", label: "Oferta", hint: "Fundo escuro e valor em evidência" },
];

const statusLabel: Record<Status, string> = { SENDING: "Enviando", SENT: "Enviado", CANCELLED: "Cancelado" };
const categoryLabel = Object.fromEntries(categories.map((item) => [item.id, item.label])) as Record<Category, string>;

const emptyDraft: Draft = {
  subject: "", category: "NEWS", layout: "HIGHLIGHT", headline: "", highlight: "",
  body: "", imageUrl: "", ctaLabel: "", ctaUrl: "",
};

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? `Não foi possível concluir (erro ${response.status}).`;
}

function draftReady(draft: Draft) {
  return draft.subject.trim().length >= 3 && draft.headline.trim().length >= 2 && draft.body.trim().length >= 10;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminBroadcasts() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState<Broadcast | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const stopRef = useRef(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/broadcasts", { cache: "no-store" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setListing(await response.json() as Listing);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os comunicados.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Prévia gerada pelo próprio servidor: é exatamente o HTML que o cliente vai receber.
  useEffect(() => {
    if (!draftReady(draft)) { setPreview(""); setPreviewError(""); return; }
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiFetch("/api/admin/broadcasts/preview", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
        });
        if (!response.ok) { setPreviewError(await errorMessage(response)); return; }
        const result = await response.json() as { html: string };
        setPreview(result.html); setPreviewError("");
      } catch { setPreviewError("Não foi possível gerar a prévia agora."); }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [draft]);

  async function sendTest() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/admin/broadcasts/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { email: string };
      setNotice(`Teste enviado para ${result.email}. Confira a caixa de entrada (e o spam).`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível enviar o teste."); }
    finally { setBusy(false); }
  }

  const runBatches = useCallback(async (broadcast: Broadcast) => {
    stopRef.current = false;
    setSending(broadcast);
    let current = broadcast;
    try {
      while (current.status === "SENDING" && !stopRef.current) {
        const response = await apiFetch(`/api/admin/broadcasts/${current.id}/send`, { method: "POST" });
        if (!response.ok) throw new Error(await errorMessage(response));
        current = await response.json() as Broadcast;
        setSending(current);
        if (current.paused) {
          setError("O servidor de e-mail recusou vários envios seguidos (provável limite por hora). O restante ficou na fila: tente continuar mais tarde.");
          break;
        }
      }
      if (current.status === "SENT") setNotice(`Comunicado enviado para ${current.sent} ${current.sent === 1 ? "cliente" : "clientes"}${current.failed ? ` (${current.failed} com falha)` : ""}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O envio foi interrompido. Você pode continuar pelo histórico.");
    } finally {
      setSending(null);
      void load();
    }
  }, [load]);

  async function startSending(event: FormEvent) {
    event.preventDefault();
    setConfirming(false); setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/admin/broadcasts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const created = await response.json() as Broadcast;
      setDraft(emptyDraft);
      void runBatches(created);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar o comunicado."); }
    finally { setBusy(false); }
  }

  async function cancel(broadcast: Broadcast) {
    stopRef.current = true;
    try {
      const response = await apiFetch(`/api/admin/broadcasts/${broadcast.id}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setNotice("Envio cancelado. Quem já recebeu continua com o e-mail.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível cancelar."); }
    finally { void load(); }
  }

  const ready = draftReady(draft);
  const audience = listing?.audience ?? 0;
  const progress = sending && sending.total ? Math.round(((sending.sent + sending.failed) / sending.total) * 100) : 0;

  return <>
    {(error || notice) && <div className={`notice-bar ${error ? "operation-error" : ""}`} role={error ? "alert" : "status"}>{error ? <CircleHelp size={16} /> : <Check size={16} />}<span>{error || notice}</span><button type="button" className="icon-button" aria-label="Fechar aviso" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></button></div>}
    {listing && !listing.smtpReady && <div className="notice-bar operation-error" role="alert"><CircleHelp size={16} /><span>O SMTP não está configurado no servidor: dá para montar e ver a prévia, mas não enviar.</span></div>}

    {sending && <section className="content-panel send-progress" aria-live="polite">
      <div className="panel-heading"><div><p className="panel-kicker">Enviando agora</p><h2>{sending.subject}</h2></div><button type="button" className="secondary-button compact-button" onClick={() => { stopRef.current = true; }}><Pause size={15} /> Pausar</button></div>
      <div className="breakdown-track progress-track"><span style={{ width: `${progress}%` }} /></div>
      <p className="panel-foot">{sending.sent} de {sending.total} enviados{sending.failed ? ` · ${sending.failed} com falha` : ""} · não feche esta aba até terminar.</p>
    </section>}

    <section className="broadcast-layout">
      <form className="content-panel broadcast-form" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
        <div className="panel-heading"><div><p className="panel-kicker">Nova mensagem</p><h2>Escreva o comunicado</h2></div><span className="quiet-count">{audience} {audience === 1 ? "DESTINATÁRIO" : "DESTINATÁRIOS"}</span></div>

        <fieldset className="choice-group"><legend>Categoria</legend>
          <div className="choice-chips">{categories.map((item) => <label key={item.id} className={`choice-chip ${draft.category === item.id ? "choice-active" : ""}`}><input type="radio" name="category" value={item.id} checked={draft.category === item.id} onChange={() => set("category", item.id)} /><strong>{item.label}</strong><small>{item.hint}</small></label>)}</div>
        </fieldset>

        <fieldset className="choice-group"><legend>Layout</legend>
          <div className="layout-options">{layouts.map((item) => <label key={item.id} className={`layout-option ${draft.layout === item.id ? "choice-active" : ""}`}><input type="radio" name="layout" value={item.id} checked={draft.layout === item.id} onChange={() => set("layout", item.id)} /><span className={`layout-thumb layout-thumb-${item.id.toLowerCase()}`} aria-hidden="true"><i /><b /><em /><em /></span><strong>{item.label}</strong><small>{item.hint}</small></label>)}</div>
        </fieldset>

        <div className="field"><label htmlFor="bc-subject">Assunto do e-mail</label><input id="bc-subject" value={draft.subject} onChange={(event) => set("subject", event.target.value)} maxLength={160} placeholder="Ex.: Chegou o Orange+ Founders Edition" required /></div>
        <div className="form-row">
          <div className="field"><label htmlFor="bc-headline">Título</label><input id="bc-headline" value={draft.headline} onChange={(event) => set("headline", event.target.value)} maxLength={120} placeholder="Ex.: Uma garrafa nova" required /></div>
          <div className="field"><label htmlFor="bc-highlight">{draft.layout === "OFFER" ? "Valor em destaque" : "Destaque (opcional)"}</label><input id="bc-highlight" value={draft.highlight} onChange={(event) => set("highlight", event.target.value)} maxLength={80} placeholder={draft.layout === "OFFER" ? "Ex.: 20% OFF" : "Ex.: para você."} /></div>
        </div>
        <div className="field"><label htmlFor="bc-body">Mensagem</label><textarea id="bc-body" value={draft.body} onChange={(event) => set("body", event.target.value)} maxLength={8000} rows={8} placeholder={"Escreva o texto do e-mail.\n\nDeixe uma linha em branco entre os parágrafos."} required /><small className="field-hint">Use <code>{"{{nome}}"}</code> para colocar o primeiro nome do cliente. {draft.body.length}/8000</small></div>
        <div className="field"><label htmlFor="bc-image">Imagem (opcional)</label><input id="bc-image" type="url" value={draft.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} maxLength={500} placeholder="https://app.bebaorange.com/fruta-laranja-1200.webp" /><small className="field-hint">Link público https de uma imagem, com 1200 px de largura de preferência.</small></div>
        <div className="form-row">
          <div className="field"><label htmlFor="bc-cta-label">Texto do botão (opcional)</label><input id="bc-cta-label" value={draft.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} maxLength={60} placeholder="Ex.: Conhecer agora" /></div>
          <div className="field"><label htmlFor="bc-cta-url">Link do botão</label><input id="bc-cta-url" type="url" value={draft.ctaUrl} onChange={(event) => set("ctaUrl", event.target.value)} maxLength={500} placeholder="https://app.bebaorange.com" /></div>
        </div>

        <div className="broadcast-actions">
          <button type="button" className="secondary-button" onClick={() => void sendTest()} disabled={!ready || busy || !!sending}><Send size={15} /> Enviar teste para mim</button>
          <button type="submit" className="primary-button" disabled={!ready || busy || !!sending || !audience || listing?.smtpReady === false}><Send size={16} /> Enviar para {audience} {audience === 1 ? "cliente" : "clientes"}</button>
        </div>
        <p className="form-footnote">Recebem os clientes com e-mail confirmado{listing?.unsubscribed ? `, menos ${listing.unsubscribed} que pediram para sair da lista` : ""}. Todo e-mail sai com o link de descadastro.</p>
      </form>

      <aside className="content-panel broadcast-preview">
        <div className="panel-heading"><div><p className="panel-kicker">Prévia</p><h2>Como o cliente vê</h2></div>
          <div className="segmented" role="group" aria-label="Tamanho da prévia"><button type="button" className={device === "desktop" ? "segmented-active" : ""} onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"}><Monitor size={15} /><span>Computador</span></button><button type="button" className={device === "mobile" ? "segmented-active" : ""} onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"}><Smartphone size={15} /><span>Celular</span></button></div>
        </div>
        <div className="preview-meta"><span>De: <strong>Orange</strong></span><span>Assunto: <strong>{draft.subject || "—"}</strong></span></div>
        <div className={`preview-frame preview-${device}`}>
          {preview
            ? <iframe title="Prévia do e-mail" srcDoc={preview} sandbox="" />
            : <div className="operation-empty"><Send size={22} /><strong>{previewError || "A prévia aparece aqui"}</strong><span>{previewError ? "Ajuste os campos marcados." : "Preencha assunto, título e mensagem."}</span></div>}
        </div>
      </aside>
    </section>

    <section className="content-panel broadcast-history">
      <div className="panel-heading"><div><p className="panel-kicker">Histórico</p><h2>Comunicados enviados</h2></div><button type="button" className="secondary-button compact-button" onClick={() => void load()}><RefreshCw size={15} /> Atualizar</button></div>
      {!listing ? <p className="panel-empty">Carregando…</p> : listing.broadcasts.length === 0 ? <p className="panel-empty">Nenhum comunicado enviado ainda.</p> : <ul className="recent-list">{listing.broadcasts.map((item) => (
        <li key={item.id}><div className="history-row">
          <span className="recent-main"><strong>{item.subject}</strong><small>{categoryLabel[item.category]} · {dateLabel(item.createdAt)} · {item.sent}/{item.total} enviados{item.failed ? ` · ${item.failed} falhas` : ""}</small></span>
          <span className={`operation-status ${item.status === "SENT" ? "operation-status-resolved" : item.status === "SENDING" ? "operation-status-open" : ""}`}>{item.status === "SENDING" && item.pending ? `Na fila · ${item.pending}` : statusLabel[item.status]}</span>
          {item.status === "SENDING" && !sending && <span className="history-actions"><button type="button" className="secondary-button compact-button" onClick={() => void runBatches(item)}><Play size={14} /> Continuar</button><button type="button" className="icon-button plan-remove" aria-label="Cancelar envio" title="Cancelar envio" onClick={() => void cancel(item)}><X size={15} /></button></span>}
        </div></li>
      ))}</ul>}
    </section>

    {confirming && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirming(false); }}>
      <section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="bc-confirm-title">
        <div className="modal-heading"><div><p className="panel-kicker">Confirmar envio</p><h2 id="bc-confirm-title">Enviar para {audience} {audience === 1 ? "cliente" : "clientes"}?</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={() => setConfirming(false)}><X size={19} /></button></div>
        <form className="modal-form" onSubmit={startSending}>
          <p className="modal-copy"><strong>{draft.subject}</strong> vai para a caixa de entrada de todos os clientes com e-mail confirmado. Depois de enviado, o e-mail não pode ser desfeito.</p>
          <p className="form-footnote">O envio acontece em lotes. Mantenha esta aba aberta até a barra chegar ao fim; se fechar, dá para continuar pelo histórico.</p>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirming(false)}>Revisar</button><button type="submit" className="primary-button" disabled={busy}><Send size={16} /> Enviar agora</button></div>
        </form>
      </section>
    </div>}
  </>;
}
