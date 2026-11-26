const backendUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL
  ?? (process.env.NODE_ENV === "production" ? "https://api-app.bebaorange.com" : "http://localhost:4000")
).replace(/\/+$/, "");

export function apiUrl(path: string) {
  return `${backendUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), { ...init, credentials: "include" });
}
