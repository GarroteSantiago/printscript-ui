import {Diagnostic} from "../snippet.ts";

// Problem Details (RFC 9457), como lo devuelve el Snippet Service
export type Problem = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  diagnostics?: Diagnostic[]
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem?: Problem) {
    super(ApiError.messageFor(status, problem))
    this.name = "ApiError"
  }

  get diagnostics(): Diagnostic[] {
    return this.problem?.diagnostics ?? []
  }

  private static messageFor(status: number, problem?: Problem): string {
    const base = problem?.detail || problem?.title || defaultMessages[status] || `Error ${status}`
    const diagnostics = problem?.diagnostics ?? []
    if (diagnostics.length === 0) return base
    return `${base}: ${diagnostics.map(d => `${d.message} (${d.line}:${d.column})`).join("; ")}`
  }
}

const defaultMessages: Record<number, string> = {
  400: "Invalid request",
  401: "Session expired, log in again",
  403: "You don't have permission to do that",
  404: "Not found",
  422: "Invalid code",
  502: "A backend service failed, try again later",
}

export type TokenProvider = () => string | undefined | Promise<string | undefined>

export type ApiClientOptions = {
  baseUrl: string
  getToken: TokenProvider
  // Se llama ante un 401 (por ejemplo, para volver al login)
  onUnauthorized?: () => void
  fetch?: typeof fetch
}

type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export class ApiClient {
  private readonly fetchFn: typeof fetch

  constructor(private readonly options: ApiClientOptions) {
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init))
  }

  async request<T>(method: string, path: string, {query, body}: RequestOptions = {}): Promise<T> {
    const response = await this.send(method, path, query, body)
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  async requestText(method: string, path: string, {query}: RequestOptions = {}): Promise<string> {
    const response = await this.send(method, path, query)
    return response.text()
  }

  private async send(method: string, path: string, query?: RequestOptions["query"], body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {Accept: "application/json, application/problem+json"}
    const token = await this.options.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers["Content-Type"] = "application/json"

    const response = await this.fetchFn(this.url(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) {
      if (response.status === 401) this.options.onUnauthorized?.()
      throw new ApiError(response.status, await readProblem(response))
    }
    return response
  }

  private url(path: string, query?: RequestOptions["query"]): string {
    const params = new URLSearchParams()
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.append(key, String(value))
    })
    const qs = params.toString()
    return `${this.options.baseUrl}${path}${qs ? `?${qs}` : ""}`
  }
}

const readProblem = async (response: Response): Promise<Problem | undefined> => {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) as Problem : undefined
  } catch {
    return undefined
  }
}
