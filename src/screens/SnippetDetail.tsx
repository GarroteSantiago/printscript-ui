import {useEffect, useState} from "react";
import Editor from "react-simple-code-editor";
import {highlight, languages} from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-okaidia.css";
import {Alert, Box, CircularProgress, IconButton, Menu, MenuItem, Tooltip, Typography} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import {
  useUpdateSnippetById
} from "../utils/queries.tsx";
import {useDownloadSnippet, useFormatSnippet, useGetSnippetById, useShareSnippet} from "../utils/queries.tsx";
import type {DownloadedFile} from "../utils/api/apiClient.ts";
import {Bòx} from "../components/snippet-table/SnippetBox.tsx";
import {BugReport, Delete, Download, Save, Share} from "@mui/icons-material";
import {ShareSnippetModal} from "../components/snippet-detail/ShareSnippetModal.tsx";
import {TestSnippetModal} from "../components/snippet-test/TestSnippetModal.tsx";
import {Snippet} from "../utils/snippet.ts";
import {useSnackbarContext} from "../contexts/snackbarContext.tsx";
import {SnippetExecution} from "./SnippetExecution.tsx";
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import {queryClient} from "../App.tsx";
import {DeleteConfirmationModal} from "../components/snippet-detail/DeleteConfirmationModal.tsx";

type SnippetDetailProps = {
  id: string;
  handleCloseModal: () => void;
}

// Guarda el archivo en el navegador con un link temporal
const saveFile = ({filename, content}: DownloadedFile) => {
  const url = URL.createObjectURL(new Blob([content], {type: 'text/plain'}))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revocarla en el mismo tick puede cortar la descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// US-13: el original o la versión formateada con las reglas del usuario, desde el Snippet Service
const DownloadButton = ({snippet}: { snippet?: Snippet }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const {mutate: download, isLoading} = useDownloadSnippet()
  if (!snippet) return null;

  const handleDownload = (formatted: boolean) => {
    setAnchor(null)
    download({id: snippet.id, formatted}, {onSuccess: saveFile})
  }

  return (
    <>
      <Tooltip title={"Download"}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} disabled={isLoading}>
          <Download/>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => handleDownload(false)}>Original</MenuItem>
        <MenuItem onClick={() => handleDownload(true)}>Formatted</MenuItem>
      </Menu>
    </>
  )
}

export const SnippetDetail = (props: SnippetDetailProps) => {
  const {id, handleCloseModal} = props;
  const [code, setCode] = useState(
      ""
  );
  const [shareModalOppened, setShareModalOppened] = useState(false)
  const [deleteConfirmationModalOpen, setDeleteConfirmationModalOpen] = useState(false)
  const [testModalOpened, setTestModalOpened] = useState(false);

  const {data: snippet, isLoading} = useGetSnippetById(id);
  // Compartir, guardar y borrar son solo del OWNER
  const isOwner = snippet?.relation !== 'shared'
  const {createSnackbar} = useSnackbarContext()
  const {mutate: shareSnippet, isLoading: loadingShare} = useShareSnippet({
    onSuccess: () => {
      setShareModalOppened(false)
      createSnackbar('success', "Snippet shared")
    }
  })
  const {mutate: formatSnippet, isLoading: isFormatLoading, data: formatSnippetData} = useFormatSnippet()
  const {mutate: updateSnippet, isLoading: isUpdateSnippetLoading} = useUpdateSnippetById({onSuccess: () => {
    queryClient.invalidateQueries(['snippet', id])
    queryClient.invalidateQueries('listSnippets')
  }})

  useEffect(() => {
    if (snippet) {
      setCode(snippet.content);
    }
  }, [snippet]);

  useEffect(() => {
    if (formatSnippetData) {
      setCode(formatSnippetData)
    }
  }, [formatSnippetData])


  async function handleShareSnippet(userId: string) {
    shareSnippet({snippetId: id, userId})
  }

  return (
      <Box p={4} minWidth={'60vw'}>
        <Box width={'100%'} p={2} display={'flex'} justifyContent={'flex-end'}>
          <CloseIcon style={{cursor: "pointer"}} onClick={handleCloseModal}/>
        </Box>
        {
          isLoading ? (<>
            <Typography fontWeight={"bold"} mb={2} variant="h4">Loading...</Typography>
            <CircularProgress/>
          </>) : <>
            <Typography variant="h4" fontWeight={"bold"}>{snippet?.name ?? "Snippet"}</Typography>
            <Box display="flex" flexDirection="row" gap="8px" padding="8px">
              <Tooltip title={"Share"}>
                <IconButton onClick={() => setShareModalOppened(true)} disabled={!isOwner}>
                  <Share/>
                </IconButton>
              </Tooltip>
              <Tooltip title={"Test"}>
                <IconButton onClick={() => setTestModalOpened(true)}>
                  <BugReport/>
                </IconButton>
              </Tooltip>
              <DownloadButton snippet={snippet}/>
              <Tooltip title={"Format"}>
                <IconButton onClick={() => formatSnippet({content: code, language: snippet?.language, version: snippet?.version})} disabled={isFormatLoading}>
                  <ReadMoreIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={"Save changes"}>
                <IconButton color={"primary"} onClick={() => updateSnippet({id: id, updateSnippet: {content: code}})} disabled={!isOwner || isUpdateSnippetLoading || snippet?.content === code} >
                  <Save />
                </IconButton>
              </Tooltip>
              <Tooltip title={"Delete"}>
                <IconButton onClick={() => setDeleteConfirmationModalOpen(true)} disabled={!isOwner}>
                  <Delete color={isOwner ? "error" : "disabled"} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box display={"flex"} gap={2}>
              <Bòx flex={1} height={"fit-content"} overflow={"none"} minHeight={"500px"} bgcolor={'black'} color={'white'} code={code}>
                <Editor
                    value={code}
                    padding={10}
                    onValueChange={(code) => setCode(code)}
                    highlight={(code) => highlight(code, languages.js, "javascript")}
                    maxLength={1000}
                    style={{
                      minHeight: "500px",
                      fontFamily: "monospace",
                      fontSize: 17,
                    }}
                />
              </Bòx>
            </Box>
            {!!snippet?.lintViolations?.length && (
                <Alert severity="warning" sx={{mt: 2}}>
                  {snippet.lintViolations.map((v, i) => (
                      <div key={i}>{`${v.line}:${v.column} ${v.message}`}{v.rule ? ` (${v.rule})` : ""}</div>
                  ))}
                </Alert>
            )}
            <Box pt={1} flex={1} marginTop={2}>
              <Alert severity="info">Output</Alert>
              <SnippetExecution snippetId={id} hasUnsavedChanges={snippet?.content !== code}/>
            </Box>
          </>
        }
        <ShareSnippetModal loading={loadingShare || isLoading} open={shareModalOppened}
                           onClose={() => setShareModalOppened(false)}
                           onShare={handleShareSnippet}/>
        <TestSnippetModal snippetId={id} open={testModalOpened} onClose={() => setTestModalOpened(false)}/>
        <DeleteConfirmationModal open={deleteConfirmationModalOpen} onClose={() => setDeleteConfirmationModalOpen(false)} id={snippet?.id ?? ""} setCloseDetails={handleCloseModal} />
      </Box>
  );
}

