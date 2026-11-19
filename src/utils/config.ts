// Configuración de build (variables VITE_* de Vite). Ver README.
const env = import.meta.env

const trimSlash = (url: string) => url.replace(/\/+$/, "")

// Base de la API pública. Por defecto relativa: NGINX sirve la UI y /api en el mismo host.
export const API_URL = trimSlash(env.VITE_API_URL || "/api")

// Base de los WebSockets. Si no se configura, sale de API_URL (http -> ws, https -> wss).
export const wsBaseUrl = (location: Pick<Location, "protocol" | "host"> = window.location): string => {
  if (env.VITE_WS_URL) return trimSlash(env.VITE_WS_URL)
  if (/^https?:\/\//.test(API_URL)) return API_URL.replace(/^http/, "ws")
  const scheme = location.protocol === "https:" ? "wss:" : "ws:"
  return `${scheme}//${location.host}${API_URL}`
}

// Sin backend ni login: usa FakeSnippetOperations (desarrollo y Cypress)
export const FAKE_API = env.VITE_FAKE_API === "true"

export const OIDC = {
  authority: env.VITE_OIDC_AUTHORITY ?? "",
  clientId: env.VITE_OIDC_CLIENT_ID ?? "",
  audience: env.VITE_OIDC_AUDIENCE ?? "",
  redirectUri: env.VITE_OIDC_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : ""),
  // offline_access: refresh token, para renovar el access token sin volver al login
  scope: env.VITE_OIDC_SCOPE || "openid profile email offline_access",
}
