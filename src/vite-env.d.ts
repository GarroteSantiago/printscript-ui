/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_OIDC_AUTHORITY?: string
  readonly VITE_OIDC_CLIENT_ID?: string
  readonly VITE_OIDC_AUDIENCE?: string
  readonly VITE_OIDC_REDIRECT_URI?: string
  readonly VITE_OIDC_SCOPE?: string
  readonly VITE_FAKE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
