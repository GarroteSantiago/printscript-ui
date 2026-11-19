import './App.css';
import {RouterProvider} from "react-router";
import {createBrowserRouter} from "react-router-dom";
import HomeScreen from "./screens/Home.tsx";
import {QueryClient, QueryClientProvider} from "react-query";
import RulesScreen from "./screens/Rules.tsx";
import {useAuth, withAuthenticationRequired} from "react-oidc-context";
import {Alert, Box, Button, CircularProgress, Typography} from "@mui/material";
import {FAKE_API} from "./utils/config.ts";

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomeScreen/>
    },
    {
        path: '/rules',
        element: <RulesScreen/>
    }
]);

export const queryClient = new QueryClient()
const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router}/>
        </QueryClientProvider>
    );
}

const Redirecting = () => {
    const auth = useAuth()
    return (
        <Box display={"flex"} flexDirection={"column"} alignItems={"center"} gap={2} mt={8}>
            {auth.error ? (
                <>
                    <Alert severity="error">Login failed: {auth.error.message}</Alert>
                    <Button variant="contained" onClick={() => auth.signinRedirect()}>Log in</Button>
                </>
            ) : (
                <>
                    <CircularProgress/>
                    <Typography>Redirecting to login...</Typography>
                </>
            )}
        </Box>
    )
}

// Sin sesión, redirige al login (salvo con la API fake)
export default FAKE_API ? App : withAuthenticationRequired(App, {OnRedirecting: Redirecting});
