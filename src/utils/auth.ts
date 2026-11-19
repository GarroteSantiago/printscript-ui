import {AuthProviderProps} from "react-oidc-context";
import {OIDC} from "./config.ts";

// Cliente OIDC genérico (Authorization Code + PKCE, endpoints por discovery).
// Sirve para Auth0 y para el login local de compose; Auth0 necesita el audience como parámetro extra.
export const oidcConfig: AuthProviderProps = {
  authority: OIDC.authority,
  client_id: OIDC.clientId,
  redirect_uri: OIDC.redirectUri,
  post_logout_redirect_uri: OIDC.redirectUri,
  response_type: "code",
  scope: OIDC.scope,
  extraQueryParams: OIDC.audience ? {audience: OIDC.audience} : undefined,
  automaticSilentRenew: true,
  // Saca ?code=...&state=... de la URL después del login
  onSigninCallback: () => window.history.replaceState({}, document.title, window.location.pathname),
}
