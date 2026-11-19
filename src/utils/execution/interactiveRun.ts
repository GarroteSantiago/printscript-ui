import type {Diagnostic} from "../snippet.ts";

// Cliente de la ejecución interactiva (contracts/websocket.md)

export type RunStatus = "ok" | "error" | "stopped"

export type ClientMessage =
    | { type: "start", token: string }
    | { type: "input", value: string }
    | { type: "stop" }

export type ServerMessage =
    | { type: "output", value: string }
    | { type: "input-request", prompt?: string }
    | { type: "error", message: string, diagnostics?: Diagnostic[] }
    | { type: "done", status: RunStatus }

export type RunHandlers = {
  onOutput?: (value: string) => void
  onInputRequest?: (prompt: string) => void
  onError?: (message: string, diagnostics: Diagnostic[]) => void
  onDone?: (status: RunStatus) => void
  // Siempre se llama al final; message explica el cierre si no fue normal
  onClose?: (code: number, message?: string) => void
}

// Lo mínimo que se usa de WebSocket, para poder reemplazarlo en los tests
export type SocketLike = {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number, reason: string }) => void) | null
  onerror: ((event: unknown) => void) | null
}

export type InteractiveRunOptions = {
  url: string
  token: string
  handlers: RunHandlers
  createSocket?: (url: string) => SocketLike
}

const OPEN = 1

export const CLOSE_CODE_MESSAGES: Record<number, string> = {
  4401: "Not authenticated: log in again",
  4403: "You don't have permission to run this snippet",
  4404: "Snippet not found",
  4409: "There is already a run in progress for this session",
}

export const closeMessage = (code: number, reason?: string, done?: boolean): string | undefined => {
  if (CLOSE_CODE_MESSAGES[code]) return CLOSE_CODE_MESSAGES[code]
  if (code === 1000 || done) return undefined
  return reason ? `Connection closed (${code}): ${reason}` : `Connection closed unexpectedly (${code})`
}

export const runUrl = (wsBase: string, snippetId: string) =>
    `${wsBase.replace(/\/+$/, "")}/ws/snippets/${encodeURIComponent(snippetId)}/run`

export class InteractiveRun {
  private readonly socket: SocketLike
  private done = false
  private closed = false

  constructor({url, token, handlers, createSocket}: InteractiveRunOptions) {
    this.socket = (createSocket ?? ((u: string) => new WebSocket(u) as unknown as SocketLike))(url)

    // El handshake es público: el primer mensaje autentica
    this.socket.onopen = () => this.send({type: "start", token})

    this.socket.onmessage = (event) => {
      const message = parse(event.data)
      if (!message) return
      switch (message.type) {
        case "output":
          handlers.onOutput?.(message.value)
          break
        case "input-request":
          handlers.onInputRequest?.(message.prompt ?? "")
          break
        case "error":
          handlers.onError?.(message.message, message.diagnostics ?? [])
          break
        case "done":
          this.done = true
          handlers.onDone?.(message.status)
          break
      }
    }

    this.socket.onclose = ({code, reason}) => {
      if (this.closed) return
      this.closed = true
      handlers.onClose?.(code, closeMessage(code, reason, this.done))
    }

    // El navegador siempre manda un close después de un error; ahí se informa
    this.socket.onerror = () => undefined
  }

  get finished(): boolean {
    return this.done || this.closed
  }

  sendInput(value: string) {
    this.send({type: "input", value})
  }

  stop() {
    this.send({type: "stop"})
  }

  close() {
    if (!this.closed) this.socket.close(1000)
  }

  private send(message: ClientMessage) {
    if (this.socket.readyState === OPEN) this.socket.send(JSON.stringify(message))
  }
}

const parse = (data: unknown): ServerMessage | undefined => {
  if (typeof data !== "string") return undefined
  try {
    const message = JSON.parse(data)
    return message && typeof message.type === "string" ? message as ServerMessage : undefined
  } catch {
    return undefined
  }
}
