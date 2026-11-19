import autoBind from "auto-bind";
import {SnippetOperations} from "../snippetOperations.ts";
import {CreateSnippet, latestVersion, PaginatedSnippets, Snippet, UpdateSnippet} from "../snippet.ts";
import {PaginatedUsers} from "../users.ts";
import {Rule} from "../../types/Rule.ts";
import {TestCase} from "../../types/TestCase.ts";
import type {TestCaseResult} from "../queries.tsx";
import {FileType} from "../../types/FileType.ts";
import {ApiClient, ApiClientOptions, ApiError} from "./apiClient.ts";

const DEFAULT_LANGUAGE = "printscript"

type TestRunResult = {
  status: TestCaseResult
  outputs: string[]
}

// SnippetOperations contra la API pública (contracts/snippet-service.openapi.yaml)
export class RealSnippetOperations implements SnippetOperations {
  private readonly api: ApiClient
  private fileTypes?: Promise<FileType[]>

  constructor(options: ApiClientOptions) {
    this.api = new ApiClient(options)
    autoBind(this)
  }

  async listSnippetDescriptors(page: number, pageSize: number, snippetName?: string): Promise<PaginatedSnippets> {
    const result = await this.api.request<PaginatedSnippets>("GET", "/snippets", {
      query: {page, page_size: pageSize, name: snippetName},
    })
    // El listado no trae el contenido
    return {...result, snippets: result.snippets.map(s => ({...s, content: s.content ?? ""}))}
  }

  async createSnippet(createSnippet: CreateSnippet): Promise<Snippet> {
    const version = await this.resolveVersion(createSnippet.language, createSnippet.version)
    return this.api.request<Snippet>("POST", "/snippets", {body: {...createSnippet, version}})
  }

  async getSnippetById(id: string): Promise<Snippet | undefined> {
    try {
      return await this.api.request<Snippet>("GET", `/snippets/${id}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined
      throw e
    }
  }

  updateSnippetById(id: string, updateSnippet: UpdateSnippet): Promise<Snippet> {
    return this.api.request<Snippet>("PUT", `/snippets/${id}`, {body: updateSnippet})
  }

  getUserFriends(name: string = "", page: number = 0, pageSize: number = 10): Promise<PaginatedUsers> {
    return this.api.request<PaginatedUsers>("GET", "/users", {query: {name, page, page_size: pageSize}})
  }

  shareSnippet(snippetId: string, userId: string): Promise<Snippet> {
    return this.api.request<Snippet>("POST", `/snippets/${snippetId}/share`, {body: {userId}})
  }

  getFormatRules(): Promise<Rule[]> {
    return this.api.request<Rule[]>("GET", "/rules/format")
  }

  getLintingRules(): Promise<Rule[]> {
    return this.api.request<Rule[]>("GET", "/rules/lint")
  }

  getTestCases(snippetId: string): Promise<TestCase[]> {
    return this.api.request<TestCase[]>("GET", `/snippets/${snippetId}/tests`)
  }

  async formatSnippet(snippet: string, language: string = DEFAULT_LANGUAGE, version?: string): Promise<string> {
    const resolved = await this.resolveVersion(language, version)
    const result = await this.api.request<{ content: string }>("POST", "/format", {
      body: {content: snippet, language, version: resolved},
    })
    return result.content
  }

  postTestCase(snippetId: string, testCase: Partial<TestCase>): Promise<TestCase> {
    const body = testCaseInput(testCase)
    return testCase.id
        ? this.api.request<TestCase>("PUT", `/snippets/${snippetId}/tests/${testCase.id}`, {body})
        : this.api.request<TestCase>("POST", `/snippets/${snippetId}/tests`, {body})
  }

  async removeTestCase(snippetId: string, id: string): Promise<string> {
    await this.api.request<void>("DELETE", `/snippets/${snippetId}/tests/${id}`)
    return id
  }

  async deleteSnippet(id: string): Promise<string> {
    await this.api.request<void>("DELETE", `/snippets/${id}`)
    return id
  }

  // Un test guardado corre por su id (y queda como último resultado); uno nuevo, sin guardarlo
  async testSnippet(snippetId: string, testCase: Partial<TestCase>): Promise<TestCaseResult> {
    const result = testCase.id
        ? await this.api.request<TestRunResult>("POST", `/snippets/${snippetId}/tests/${testCase.id}/run`)
        : await this.api.request<TestRunResult>("POST", `/snippets/${snippetId}/tests/run`, {body: testCaseInput(testCase)})
    return result.status
  }

  getFileTypes(): Promise<FileType[]> {
    if (!this.fileTypes) {
      this.fileTypes = this.api.request<FileType[]>("GET", "/languages")
      this.fileTypes.catch(() => this.fileTypes = undefined)
    }
    return this.fileTypes
  }

  modifyFormatRule(newRules: Rule[]): Promise<Rule[]> {
    return this.api.request<Rule[]>("PUT", "/rules/format", {body: newRules})
  }

  modifyLintingRule(newRules: Rule[]): Promise<Rule[]> {
    return this.api.request<Rule[]>("PUT", "/rules/lint", {body: newRules})
  }

  // CreateSnippet y format exigen versión; la UI de la cátedra no la pide, se usa la última del lenguaje
  private async resolveVersion(language: string, version?: string): Promise<string> {
    if (version) return version
    const latest = latestVersion(await this.getFileTypes(), language)
    if (!latest) throw new Error(`No versions available for language ${language}`)
    return latest
  }
}

const testCaseInput = (testCase: Partial<TestCase>) => ({
  name: testCase.name || "test",
  input: testCase.input ?? [],
  output: testCase.output ?? [],
})
