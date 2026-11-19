import {beforeEach, describe, expect, it, vi} from "vitest";
import {RealSnippetOperations} from "./realSnippetOperations.ts";
import {ApiError} from "./apiClient.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {"Content-Type": status >= 400 ? "application/problem+json" : "application/json"},
})

const languages = [{language: "printscript", extension: "ps", versions: ["1.0", "1.1"]}]

const snippet = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "hello",
  language: "printscript",
  version: "1.1",
  extension: "ps",
  content: "println(\"hi\");",
  compliance: "pending",
  author: "ana",
  authorId: "auth0|ana",
  relation: "owned",
}

describe("RealSnippetOperations", () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let onUnauthorized: ReturnType<typeof vi.fn>
  let ops: RealSnippetOperations

  // Pedido n-ésimo que recibió fetch
  const call = (n = 0) => {
    const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
    return {
      url,
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    }
  }

  beforeEach(() => {
    fetchMock = vi.fn()
    onUnauthorized = vi.fn()
    ops = new RealSnippetOperations({
      baseUrl: "/api",
      getToken: () => "the-token",
      onUnauthorized,
      fetch: fetchMock as unknown as typeof fetch,
    })
  })

  it("lists snippets with pagination, name filter and bearer token", async () => {
    fetchMock.mockResolvedValue(json({page: 1, page_size: 5, count: 6, snippets: [{...snippet, content: undefined}]}))

    const page = await ops.listSnippetDescriptors(1, 5, "hel")

    expect(call().url).toBe("/api/snippets?page=1&page_size=5&name=hel")
    expect(call().method).toBe("GET")
    expect(call().headers.Authorization).toBe("Bearer the-token")
    expect(page.count).toBe(6)
    expect(page.snippets[0].content).toBe("")
  })

  it("omits empty query params", async () => {
    fetchMock.mockResolvedValue(json({page: 0, page_size: 10, count: 0, snippets: []}))

    await ops.listSnippetDescriptors(0, 10, "")

    expect(call().url).toBe("/api/snippets?page=0&page_size=10")
  })

  it("creates a snippet with the latest language version when none is given", async () => {
    fetchMock
        .mockResolvedValueOnce(json(languages))
        .mockResolvedValueOnce(json(snippet, 201))

    const created = await ops.createSnippet({name: "hello", content: "println(\"hi\");", language: "printscript", extension: "ps"})

    expect(call(0).url).toBe("/api/languages")
    expect(call(1)).toMatchObject({
      url: "/api/snippets",
      method: "POST",
      body: {name: "hello", content: "println(\"hi\");", language: "printscript", extension: "ps", version: "1.1"},
    })
    expect(call(1).headers["Content-Type"]).toBe("application/json")
    expect(created.id).toBe(snippet.id)
  })

  it("keeps the version given by the UI", async () => {
    fetchMock.mockResolvedValueOnce(json(snippet, 201))

    await ops.createSnippet({name: "hello", content: "x", language: "printscript", extension: "ps", version: "1.0"})

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(call().body.version).toBe("1.0")
  })

  it("updates only the content", async () => {
    fetchMock.mockResolvedValue(json(snippet))

    await ops.updateSnippetById(snippet.id, {content: "let a: number = 1;"})

    expect(call()).toMatchObject({url: `/api/snippets/${snippet.id}`, method: "PUT", body: {content: "let a: number = 1;"}})
  })

  it("returns undefined for a missing snippet", async () => {
    fetchMock.mockResolvedValue(json({title: "Not Found", status: 404}, 404))

    expect(await ops.getSnippetById(snippet.id)).toBeUndefined()
  })

  it("throws ApiError with the problem details and diagnostics on invalid code", async () => {
    fetchMock.mockResolvedValue(json({
      title: "Invalid code",
      status: 422,
      detail: "The code is not valid",
      diagnostics: [{rule: null, message: "Expected ';'", line: 1, column: 14}],
    }, 422))

    const error = await ops.updateSnippetById(snippet.id, {content: "println(1)"}).catch(e => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.diagnostics).toHaveLength(1)
    expect(error.message).toBe("The code is not valid: Expected ';' (1:14)")
  })

  it("uses a default message when the error has no body", async () => {
    fetchMock.mockResolvedValue(new Response(null, {status: 403}))

    const error = await ops.deleteSnippet(snippet.id).catch(e => e)

    expect(error.message).toBe("You don't have permission to do that")
  })

  it("notifies a 401 so the UI can go back to the login", async () => {
    fetchMock.mockResolvedValue(new Response(null, {status: 401}))

    await expect(ops.getFormatRules()).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it("deletes a snippet (204) and returns its id", async () => {
    fetchMock.mockResolvedValue(new Response(null, {status: 204}))

    expect(await ops.deleteSnippet(snippet.id)).toBe(snippet.id)
    expect(call()).toMatchObject({url: `/api/snippets/${snippet.id}`, method: "DELETE"})
  })

  it("downloads the original or the formatted file with the name from Content-Disposition", async () => {
    fetchMock.mockImplementation(async () => new Response("println(1);", {
      headers: {"Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="hello.ps"'},
    }))

    expect(await ops.downloadSnippet(snippet.id, true)).toEqual({filename: "hello.ps", content: "println(1);"})
    expect(call()).toMatchObject({url: `/api/snippets/${snippet.id}/download?formatted=true`, method: "GET"})
    expect(call().headers.Authorization).toBe("Bearer the-token")

    await ops.downloadSnippet(snippet.id, false)
    expect(call(1).url).toBe(`/api/snippets/${snippet.id}/download?formatted=false`)
  })

  it("fails the download with the problem details when there is no formatted version yet", async () => {
    fetchMock.mockResolvedValue(json({status: 404, detail: "Snippet x has no formatted version yet"}, 404))

    await expect(ops.downloadSnippet(snippet.id, true)).rejects.toThrow("has no formatted version yet")
  })

  it("shares a snippet with a user", async () => {
    fetchMock.mockResolvedValue(json(snippet))

    await ops.shareSnippet(snippet.id, "auth0|bob")

    expect(call()).toMatchObject({url: `/api/snippets/${snippet.id}/share`, method: "POST", body: {userId: "auth0|bob"}})
  })

  it("searches users from page 0 by default", async () => {
    fetchMock.mockResolvedValue(json({page: 0, page_size: 10, count: 0, users: []}))

    await ops.getUserFriends("bo")

    expect(call().url).toBe("/api/users?name=bo&page=0&page_size=10")
  })

  it("reads and saves rules by type", async () => {
    const rules = [{id: "r1", name: "enforce-spacing", isActive: true, value: null}]
    fetchMock.mockResolvedValueOnce(json(rules)).mockResolvedValueOnce(json(rules, 202))

    expect(await ops.getLintingRules()).toEqual(rules)
    expect(await ops.modifyFormatRule(rules)).toEqual(rules)

    expect(call(0)).toMatchObject({url: "/api/rules/lint", method: "GET"})
    expect(call(1)).toMatchObject({url: "/api/rules/format", method: "PUT", body: rules})
  })

  it("formats with the snippet language and version", async () => {
    fetchMock.mockResolvedValue(json({content: "let a: number = 1;\n"}))

    const formatted = await ops.formatSnippet("let a:number=1;", "printscript", "1.0")

    expect(formatted).toBe("let a: number = 1;\n")
    expect(call()).toMatchObject({url: "/api/format", method: "POST", body: {content: "let a:number=1;", language: "printscript", version: "1.0"}})
  })

  it("caches the languages", async () => {
    fetchMock.mockResolvedValueOnce(json(languages)).mockResolvedValueOnce(json({content: "x"}))

    await ops.getFileTypes()
    await ops.formatSnippet("x")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(call(1).body.version).toBe("1.1")
  })

  describe("tests of a snippet", () => {
    const base = `/api/snippets/${snippet.id}/tests`

    it("lists them", async () => {
      fetchMock.mockResolvedValue(json([{id: "t1", name: "a", input: [], output: ["hi"], lastResult: "success"}]))

      const tests = await ops.getTestCases(snippet.id)

      expect(call().url).toBe(base)
      expect(tests[0].lastResult).toBe("success")
    })

    it("creates a new one and edits an existing one", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(json({id: "t1", name: "a"})))

      await ops.postTestCase(snippet.id, {name: "a", output: ["hi"]})
      await ops.postTestCase(snippet.id, {id: "t1", name: "a", input: ["1"], output: ["1"]})

      expect(call(0)).toMatchObject({url: base, method: "POST", body: {name: "a", input: [], output: ["hi"]}})
      expect(call(1)).toMatchObject({url: `${base}/t1`, method: "PUT", body: {name: "a", input: ["1"], output: ["1"]}})
    })

    it("removes one", async () => {
      fetchMock.mockResolvedValue(new Response(null, {status: 204}))

      expect(await ops.removeTestCase(snippet.id, "t1")).toBe("t1")
      expect(call()).toMatchObject({url: `${base}/t1`, method: "DELETE"})
    })

    it("runs a saved test by id and an unsaved one ad hoc", async () => {
      fetchMock
          .mockResolvedValueOnce(json({status: "success", outputs: ["hi"]}))
          .mockResolvedValueOnce(json({status: "fail", outputs: []}))

      expect(await ops.testSnippet(snippet.id, {id: "t1", name: "a"})).toBe("success")
      expect(await ops.testSnippet(snippet.id, {name: "b", output: ["hi"]})).toBe("fail")

      expect(call(0)).toMatchObject({url: `${base}/t1/run`, method: "POST", body: undefined})
      expect(call(1)).toMatchObject({url: `${base}/run`, method: "POST", body: {name: "b", input: [], output: ["hi"]}})
    })
  })

  it("does not send Authorization without a token", async () => {
    const anonymous = new RealSnippetOperations({baseUrl: "/api", getToken: () => undefined, fetch: fetchMock as unknown as typeof fetch})
    fetchMock.mockResolvedValue(json([]))

    await anonymous.getFormatRules()

    expect(call().headers.Authorization).toBeUndefined()
  })
})
