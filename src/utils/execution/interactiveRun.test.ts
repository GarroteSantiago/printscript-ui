import {beforeEach, describe, expect, it, vi} from "vitest";
import {closeMessage, InteractiveRun, runUrl, SocketLike} from "./interactiveRun.ts";

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  closedWith?: number
  onopen: SocketLike["onopen"] = null
  onmessage: SocketLike["onmessage"] = null
  onclose: SocketLike["onclose"] = null
  onerror: SocketLike["onerror"] = null

  constructor(readonly url: string) {
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close(code?: number) {
    this.closedWith = code
    this.serverClose(code ?? 1005)
  }

  // Lado del servidor
  open() {
    this.readyState = 1
    this.onopen?.({})
  }

  receive(message: unknown) {
    this.onmessage?.({data: JSON.stringify(message)})
  }

  serverClose(code: number, reason = "") {
    this.readyState = 3
    this.onclose?.({code, reason})
  }
}

describe("InteractiveRun", () => {
  let socket: FakeSocket
  const handlers = {
    onOutput: vi.fn(),
    onInputRequest: vi.fn(),
    onError: vi.fn(),
    onDone: vi.fn(),
    onClose: vi.fn(),
  }

  const start = () => new InteractiveRun({
    url: "ws://localhost/api/ws/snippets/abc/run",
    token: "jwt",
    handlers,
    createSocket: url => socket = new FakeSocket(url),
  })

  beforeEach(() => Object.values(handlers).forEach(h => h.mockReset()))

  it("authenticates with the token in the first message", () => {
    start()
    expect(socket.url).toBe("ws://localhost/api/ws/snippets/abc/run")
    expect(socket.sent).toEqual([])

    socket.open()

    expect(socket.sent).toEqual([{type: "start", token: "jwt"}])
  })

  it("reports output, input requests and sends the inputs", () => {
    const run = start()
    socket.open()

    socket.receive({type: "output", value: "Hello"})
    socket.receive({type: "input-request", prompt: "Enter a number"})
    run.sendInput("42")
    socket.receive({type: "output", value: "42"})

    expect(handlers.onOutput.mock.calls).toEqual([["Hello"], ["42"]])
    expect(handlers.onInputRequest).toHaveBeenCalledWith("Enter a number")
    expect(socket.sent).toEqual([{type: "start", token: "jwt"}, {type: "input", value: "42"}])
  })

  it("reports errors with diagnostics and the final status", () => {
    const run = start()
    socket.open()

    const diagnostics = [{rule: null, message: "Undeclared variable a", line: 2, column: 9}]
    socket.receive({type: "error", message: "Runtime error", diagnostics})
    socket.receive({type: "done", status: "error"})
    socket.serverClose(1000)

    expect(handlers.onError).toHaveBeenCalledWith("Runtime error", diagnostics)
    expect(handlers.onDone).toHaveBeenCalledWith("error")
    expect(handlers.onClose).toHaveBeenCalledWith(1000, undefined)
    expect(run.finished).toBe(true)
  })

  it("sends stop", () => {
    const run = start()
    socket.open()

    run.stop()
    socket.receive({type: "done", status: "stopped"})

    expect(socket.sent).toContainEqual({type: "stop"})
    expect(handlers.onDone).toHaveBeenCalledWith("stopped")
  })

  it.each([
    [4401, "Not authenticated: log in again"],
    [4403, "You don't have permission to run this snippet"],
    [4404, "Snippet not found"],
    [4409, "There is already a run in progress for this session"],
  ])("explains the close code %i", (code, message) => {
    start()
    socket.open()

    socket.serverClose(code)

    expect(handlers.onClose).toHaveBeenCalledWith(code, message)
  })

  it("reports a connection lost before the run finished", () => {
    start()
    socket.open()

    socket.serverClose(1006)

    expect(handlers.onClose).toHaveBeenCalledWith(1006, "Connection closed unexpectedly (1006)")
  })

  it("ignores messages that are not JSON or have no type", () => {
    start()
    socket.open()

    socket.onmessage?.({data: "not json"})
    socket.receive({value: "x"})

    expect(handlers.onOutput).not.toHaveBeenCalled()
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it("does not send before the socket opens and closes normally", () => {
    const run = start()

    run.sendInput("too soon")
    run.close()

    expect(socket.sent).toEqual([])
    expect(socket.closedWith).toBe(1000)
    expect(handlers.onClose).toHaveBeenCalledOnce()
  })
})

describe("runUrl / closeMessage", () => {
  it("builds the public endpoint", () => {
    expect(runUrl("wss://host/api/", "a b")).toBe("wss://host/api/ws/snippets/a%20b/run")
  })

  it("only explains abnormal closes", () => {
    expect(closeMessage(1000)).toBeUndefined()
    expect(closeMessage(1011, "boom", true)).toBeUndefined()
    expect(closeMessage(1011, "boom")).toBe("Connection closed (1011): boom")
  })
})
