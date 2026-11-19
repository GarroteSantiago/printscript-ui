import React, {ReactNode} from 'react';
import App from './App.tsx'
import './index.css'
import {createRoot} from "react-dom/client";
import {AuthProvider} from "react-oidc-context";
import {PaginationProvider} from "./contexts/paginationProvider.tsx";
import {SnackbarProvider} from "./contexts/snackbarProvider.tsx";
import {AuthSessionProvider, FakeSessionProvider} from "./contexts/sessionProvider.tsx";
import {FAKE_API} from "./utils/config.ts";
import {oidcConfig} from "./utils/auth.ts";

const Session = ({children}: { children: ReactNode }) => FAKE_API
    ? <FakeSessionProvider>{children}</FakeSessionProvider>
    : (
        <AuthProvider {...oidcConfig}>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </AuthProvider>
    )

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Session>
            <PaginationProvider>
                <SnackbarProvider>
                    <App/>
                </SnackbarProvider>
            </PaginationProvider>
        </Session>
    </React.StrictMode>,
)
