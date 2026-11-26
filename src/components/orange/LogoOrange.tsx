// Logo oficial da Orange, estático, na cor do texto (currentColor).
import { LOGO_ALTURA, LOGO_LARGURA, LOGO_PATHS } from "@/lib/logo-orange";

export default function LogoOrange({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${LOGO_LARGURA} ${LOGO_ALTURA}`} aria-hidden="true">
      {LOGO_PATHS.map((d, i) => <path key={i} d={d} fill="currentColor" />)}
    </svg>
  );
}
