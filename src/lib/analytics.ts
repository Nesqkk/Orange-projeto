// Medição de visitas e conversão: Meta Pixel + Google Analytics 4.
//
// Os IDs vêm de variáveis públicas lidas no BUILD (o site é export estático):
//   NEXT_PUBLIC_META_PIXEL_ID  ex.: 123456789012345
//   NEXT_PUBLIC_GA_ID          ex.: G-XXXXXXXXXX
// Sem ID definido, nenhuma chamada faz nada e nenhum script externo é carregado.
//
// As funções criam a fila (stub) do fbq/gtag na hora, então um evento disparado
// antes de o script externo terminar de carregar fica na fila e é enviado depois.

type Params = Record<string, unknown>;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
export const analyticsEnabled = Boolean(META_PIXEL_ID || GA_ID);

/** Evento de janela que o componente <Analytics /> escuta para registrar o cadastro. */
export const CADASTRO_EVENT = "orange:cadastro";

let initialized = false;
let lastPageView = "";

function ensureFbq(): Fbq | null {
  if (!META_PIXEL_ID || typeof window === "undefined") return null;
  if (!window.fbq) {
    // Mesmo stub do snippet oficial da Meta, sem injetar o <script> (quem carrega é next/script).
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq ??= fbq;
  }
  return window.fbq;
}

function ensureGtag(): ((...args: unknown[]) => void) | null {
  if (!GA_ID || typeof window === "undefined") return null;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // O gtag.js exige o objeto `arguments`, não um array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  return window.gtag;
}

/** Configura Pixel e GA4 uma única vez. Chamado pelo componente <Analytics />. */
export function initAnalytics() {
  if (initialized || !analyticsEnabled || typeof window === "undefined") return;
  initialized = true;
  ensureFbq()?.("init", META_PIXEL_ID);
  const gtag = ensureGtag();
  if (gtag) {
    gtag("js", new Date());
    // page_view é enviado manualmente em trackPageView (inclusive na navegação client-side).
    gtag("config", GA_ID, { send_page_view: false });
  }
}

/** PageView no Meta e page_view no GA4. Ignora repetição da mesma URL. */
export function trackPageView(url?: string) {
  if (!analyticsEnabled || typeof window === "undefined") return;
  const location = url ?? window.location.href;
  if (location === lastPageView) return;
  lastPageView = location;
  ensureFbq()?.("track", "PageView");
  ensureGtag()?.("event", "page_view", {
    page_location: location,
    page_path: window.location.pathname,
    page_title: document.title,
  });
}

export type CadastroParams = {
  /** Como a conta foi criada: "email", "google", "apple"... */
  method?: string;
};

export type CompraParams = {
  /** Valor total da compra em reais (ex.: 89.9). */
  value: number;
  /** Padrão "BRL". */
  currency?: string;
  /** ID do pedido/pagamento. Evita contagem dupla (eventID na Meta, transaction_id no GA4). */
  transactionId?: string;
  items?: Array<{ item_id: string; item_name?: string; price?: number; quantity?: number }>;
};

/** Cadastro concluído. Meta: CompleteRegistration. GA4: sign_up. */
export function trackCadastro({ method = "email" }: CadastroParams = {}) {
  if (!analyticsEnabled || typeof window === "undefined") return;
  ensureFbq()?.("track", "CompleteRegistration", { status: true, content_name: method });
  ensureGtag()?.("event", "sign_up", { method });
}

/**
 * Compra concluída. Meta: Purchase. GA4: purchase.
 * Chame na página de obrigado/retorno do checkout, só quando o pagamento foi aprovado.
 * Com transactionId, a mesma compra não é contada duas vezes se a página for recarregada.
 */
export function trackCompra({ value, currency = "BRL", transactionId, items }: CompraParams) {
  if (!analyticsEnabled || typeof window === "undefined") return;
  if (!Number.isFinite(value) || value < 0) return;

  if (transactionId) {
    const key = `orange-compra-medida:${transactionId}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Armazenamento bloqueado: segue sem a proteção contra recarga.
    }
  }

  const contentIds = items?.map((item) => item.item_id);
  ensureFbq()?.(
    "track",
    "Purchase",
    { value, currency, ...(contentIds?.length ? { content_ids: contentIds, content_type: "product" } : {}) },
    transactionId ? { eventID: transactionId } : undefined,
  );
  ensureGtag()?.("event", "purchase", {
    value,
    currency,
    ...(transactionId ? { transaction_id: transactionId } : {}),
    ...(items?.length ? { items } : {}),
  });
}

/** Atalho: track("cadastro") ou track("compra", { value: 89.9, transactionId }). */
export function track(event: "cadastro", params?: CadastroParams): void;
export function track(event: "compra", params: CompraParams): void;
export function track(event: "cadastro" | "compra", params?: Params) {
  if (event === "cadastro") trackCadastro(params as CadastroParams | undefined);
  else if (params) trackCompra(params as CompraParams);
}
