import {describe, expect, it} from "vitest";
import {API_URL, wsBaseUrl} from "./config.ts";

describe("config", () => {
  it("defaults to the API behind NGINX in the same host", () => {
    expect(API_URL).toBe("/api")
    expect(wsBaseUrl({protocol: "https:", host: "snippets.example.com"})).toBe("wss://snippets.example.com/api")
    expect(wsBaseUrl({protocol: "http:", host: "localhost:8080"})).toBe("ws://localhost:8080/api")
  })
})
