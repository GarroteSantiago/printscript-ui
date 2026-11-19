import {Alert, Box, Button, Chip, OutlinedInput, Typography} from "@mui/material";
import {PlayArrow, StopRounded} from "@mui/icons-material";
import {highlight, languages} from "prismjs";
import Editor from "react-simple-code-editor";
import {Bòx} from "../components/snippet-table/SnippetBox.tsx";
import {useEffect, useRef, useState} from "react";
import {InteractiveRun, RunStatus, runUrl} from "../utils/execution/interactiveRun.ts";
import {wsBaseUrl} from "../utils/config.ts";
import {useSessionContext} from "../contexts/sessionContext.tsx";
import {Diagnostic} from "../utils/snippet.ts";

type SnippetExecutionProps = {
  snippetId: string
  // El código del editor no coincide con el guardado: se ejecuta la versión guardada
  hasUnsavedChanges?: boolean
}

type RunError = {
  message: string
  diagnostics: Diagnostic[]
}

const statusChip: Record<RunStatus, { label: string, color: "success" | "error" | "default" }> = {
  ok: {label: "Finished", color: "success"},
  error: {label: "Failed", color: "error"},
  stopped: {label: "Stopped", color: "default"},
}

// Ejecución interactiva por WebSocket (contracts/websocket.md)
export const SnippetExecution = ({snippetId, hasUnsavedChanges}: SnippetExecutionProps) => {
  const {getToken} = useSessionContext()
  const runRef = useRef<InteractiveRun | null>(null)
  const [running, setRunning] = useState(false)
  const [input, setInput] = useState<string>("")
  const [output, setOutput] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null)
  const [errors, setErrors] = useState<RunError[]>([])
  const [status, setStatus] = useState<RunStatus | null>(null)

  const code = output.join("\n")

  // Cierra el socket al salir de la pantalla o cambiar de snippet
  useEffect(() => () => runRef.current?.close(), [snippetId])

  const handleRun = () => {
    runRef.current?.close()
    setOutput([])
    setErrors([])
    setStatus(null)
    setPrompt(null)
    setRunning(true)

    // Ignora los eventos de una corrida anterior
    const isCurrent = () => runRef.current === run

    const run: InteractiveRun = new InteractiveRun({
      url: runUrl(wsBaseUrl(), snippetId),
      token: getToken() ?? "",
      handlers: {
        onOutput: value => {
          if (isCurrent()) setOutput(prev => [...prev, value])
        },
        onInputRequest: message => {
          if (isCurrent()) setPrompt(message)
        },
        onError: (message, diagnostics) => {
          if (isCurrent()) setErrors(prev => [...prev, {message, diagnostics}])
        },
        onDone: runStatus => {
          if (!isCurrent()) return
          setStatus(runStatus)
          setPrompt(null)
          run.close()
        },
        onClose: (_, message) => {
          if (!isCurrent()) return
          if (message) setErrors(prev => [...prev, {message, diagnostics: []}])
          setPrompt(null)
          setRunning(false)
        },
      },
    })
    runRef.current = run
  }

  const handleStop = () => runRef.current?.stop()

  const handleEnter = (event: { key: string }) => {
    if (event.key === 'Enter' && prompt !== null && runRef.current) {
      runRef.current.sendInput(input)
      setOutput(prev => [...prev, `${prompt ? `${prompt} ` : ""}> ${input}`])
      setPrompt(null)
      setInput("")
    }
  };

  return (
      <>
        <Box display={"flex"} alignItems={"center"} gap={2} mb={1}>
          {running ? (
              <Button variant={"outlined"} color={"error"} startIcon={<StopRounded/>} onClick={handleStop}>
                Stop
              </Button>
          ) : (
              <Button variant={"contained"} disableElevation startIcon={<PlayArrow/>} onClick={handleRun}>
                Run
              </Button>
          )}
          {status && <Chip label={statusChip[status].label} color={statusChip[status].color}/>}
          {hasUnsavedChanges && <Typography variant={"body2"}>Runs the saved version of the snippet</Typography>}
        </Box>
        <Bòx flex={1} overflow={"none"} minHeight={200} bgcolor={'black'} color={'white'} code={code}>
          <Editor
              value={code}
              padding={10}
              onValueChange={() => undefined}
              readOnly
              highlight={(code) => highlight(code, languages.js, 'javascript')}
              maxLength={1000}
              style={{
                fontFamily: "monospace",
                fontSize: 17,
              }}
          />
        </Bòx>
        {errors.map((error, i) => (
            <Alert key={i} severity={"error"} sx={{mt: 1}}>
              {error.message}
              {error.diagnostics.map((d, j) => (
                  <div key={j}>{`${d.line}:${d.column} ${d.message}`}</div>
              ))}
            </Alert>
        ))}
        <OutlinedInput onKeyDown={handleEnter} value={input} onChange={e => setInput(e.target.value)}
                       disabled={prompt === null}
                       placeholder={prompt === null ? "Input is enabled when the snippet asks for it" : (prompt || "Type here")}
                       fullWidth sx={{mt: 1}}/>
      </>
  )
}
