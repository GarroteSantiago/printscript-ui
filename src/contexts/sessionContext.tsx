import {createContext, useContext} from 'react'
import {SnippetOperations} from "../utils/snippetOperations.ts";

export type SessionContextType = {
  operations: SnippetOperations,
  // Access token actual (para el WebSocket, que no manda headers)
  getToken: () => string | undefined,
  userName?: string,
  logout?: () => void,
}

// @ts-expect-error: siempre se usa dentro de un SessionProvider
export const SessionContext = createContext<SessionContextType>(null)

export const useSessionContext = (): SessionContextType => useContext(SessionContext)
