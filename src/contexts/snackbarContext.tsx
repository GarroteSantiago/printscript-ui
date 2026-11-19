import {createContext, useContext} from 'react'
import {AlertColor} from "@mui/material";

export type SnackBarType  = {
  severity: AlertColor,
  text: string
}

export type SnackbarContextType = {
  active: SnackBarType[],
  createSnackbar: (severity: AlertColor, text: string) => void
}


// @ts-expect-error: siempre se usa dentro de su provider
export const SnackbarContext = createContext<SnackbarContextType>(null)

export const useSnackbarContext = (): SnackbarContextType => useContext(SnackbarContext)
