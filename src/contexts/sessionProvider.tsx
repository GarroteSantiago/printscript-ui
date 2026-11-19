import {ReactNode, useMemo, useRef} from "react";
import {useAuth} from "react-oidc-context";
import {SessionContext} from "./sessionContext.tsx";
import {RealSnippetOperations} from "../utils/api/realSnippetOperations.ts";
import {FakeSnippetOperations} from "../utils/mock/fakeSnippetOperations.ts";
import {API_URL} from "../utils/config.ts";

// Sesión con login OIDC: cada pedido lleva el access token del usuario
export const AuthSessionProvider = ({children}: { children: ReactNode }) => {
  const auth = useAuth()
  const authRef = useRef(auth)
  authRef.current = auth

  const operations = useMemo(() => new RealSnippetOperations({
    baseUrl: API_URL,
    getToken: () => authRef.current.user?.access_token,
    onUnauthorized: () => {
      authRef.current.removeUser().then(() => authRef.current.signinRedirect())
    },
  }), [])

  const profile = auth.user?.profile
  const userName = profile?.name ?? profile?.nickname ?? profile?.email ?? profile?.sub

  const logout = () => {
    auth.signoutRedirect().catch(() => auth.removeUser())
  }

  return (
      <SessionContext.Provider value={{
        operations,
        getToken: () => authRef.current.user?.access_token,
        userName,
        logout,
      }}>
        {children}
      </SessionContext.Provider>
  )
}

// Sin backend ni login (VITE_FAKE_API=true)
export const FakeSessionProvider = ({children}: { children: ReactNode }) => {
  const operations = useMemo(() => new FakeSnippetOperations(), [])

  return (
      <SessionContext.Provider value={{operations, getToken: () => undefined, userName: "fake user"}}>
        {children}
      </SessionContext.Provider>
  )
}
