# printscript-ui

Fork de la UI de la cátedra ([austral-ingsis/printscript-ui](https://github.com/austral-ingsis/printscript-ui)) para Snippet Searcher. React + Vite.

Qué agrega sobre el original:

- `RealSnippetOperations` (`src/utils/api/`): implementación de `SnippetOperations` contra la API pública (`contracts/snippet-service.openapi.yaml`, en `/api`). Cada pedido lleva `Authorization: Bearer <access token>`. Los errores (Problem Details) se muestran en un snackbar.
- Login OIDC (Authorization Code + PKCE) con [`react-oidc-context`](https://github.com/authts/react-oidc-context): los endpoints salen del discovery, así que sirve tanto para Auth0 como para el login local de compose. Sin sesión, la app redirige al login.
- Ejecución interactiva (`src/screens/SnippetExecution.tsx` y `src/utils/execution/`): cliente WebSocket según `contracts/websocket.md`.
- `FakeSnippetOperations` queda para desarrollar sin backend (`VITE_FAKE_API=true`).

## Entorno

Con Nix (Node 22 y npm):

```sh
nix develop          # o direnv allow
npm ci
```

Sin Nix alcanza con Node 20 o más nuevo. Si no se van a usar los tests de Cypress, `CYPRESS_INSTALL_BINARY=0 npm ci` evita bajar el binario.

## Comandos

```sh
npm run dev      # servidor de desarrollo en http://localhost:5173 (proxy de /api al NGINX de compose)
npm run lint
npm test         # tests unitarios (Vitest)
npm run build    # build estático en dist/
npm run cypress  # tests e2e de la cátedra (con la UI levantada)
```

## Configuración

Son variables de build: Vite las fija en el bundle en `npm run build` (o al levantar `npm run dev`). Se leen del entorno o de un `.env` (ver `.env.example`).

| Variable | Default | Para qué |
|---|---|---|
| `VITE_OIDC_AUTHORITY` | — | Issuer OIDC. Auth0: `https://<tenant>.us.auth0.com/`. Login local: el issuer del servidor de compose |
| `VITE_OIDC_CLIENT_ID` | — | Client id de la aplicación SPA |
| `VITE_OIDC_AUDIENCE` | — | Audience de la API. Se manda como parámetro `audience` en el login (lo exige Auth0 para emitir un JWT para la API) |
| `VITE_OIDC_REDIRECT_URI` | origen de la página | Adónde vuelve el login; también se usa después del logout. Tiene que estar registrada en el proveedor |
| `VITE_OIDC_SCOPE` | `openid profile email offline_access` | Scopes pedidos. `offline_access` trae un refresh token, con el que la sesión se renueva sola antes de que venza el access token |
| `VITE_API_URL` | `/api` | Base de la API pública |
| `VITE_WS_URL` | sale de `VITE_API_URL` | Base de los WebSocket (`ws://` o `wss://` según la página) |
| `VITE_FAKE_API` | `false` | `true`: sin login ni backend, datos de prueba en memoria |
| `DEV_API_PROXY` | `http://localhost` | Solo `npm run dev`: adónde se manda `/api` |

En Auth0 la aplicación tiene que ser de tipo *Single Page Application*, con la URL de la UI en *Allowed Callback URLs*, *Allowed Logout URLs* y *Allowed Web Origins*. Para el refresh token: *Refresh Token Rotation* prendido en la aplicación y *Allow Offline Access* en la API. Sin refresh token, cuando vence el access token la UI vuelve al login.

## Servirla con NGINX (compose)

El NGINX de `snippet-searcher-infra` sirve `/` desde `nginx/html` (con `try_files` a `index.html`) y manda `/api` (incluido el WebSocket) al Snippet Service. Para usar esta UI:

```sh
cp .env.example .env    # completar el login (Auth0 o el local)
npm run build
rm -rf ../snippet-searcher-infra/nginx/html/* && cp -r dist/* ../snippet-searcher-infra/nginx/html/
```

Como la UI y la API quedan en el mismo host, `VITE_API_URL` y `VITE_WS_URL` no hace falta tocarlas.

También hay un `Dockerfile` que construye una imagen de NGINX con la UI; las variables se pasan como `--build-arg`:

```sh
docker build -t printscript-ui --build-arg VITE_OIDC_AUTHORITY=... --build-arg VITE_OIDC_CLIENT_ID=... --build-arg VITE_OIDC_AUDIENCE=... .
```

## Diferencias con la UI de la cátedra

- Los tests son de un snippet (`/snippets/{id}/tests`), así que `getTestCases`, `postTestCase`, `removeTestCase` y `testSnippet` reciben el `snippetId`. `postTestCase` crea (`POST`) o edita (`PUT`) según el test tenga id; `testSnippet` corre un test guardado por su id o, si no está guardado, lo corre sin guardarlo (`/tests/run`).
- `CreateSnippet` acepta `description` y `version` opcionales: la pantalla de alta deja elegir la versión y, si no viene, el cliente usa la última de `GET /languages`. `formatSnippet` manda el lenguaje y la versión del snippet.
- `UpdateSnippet` acepta cualquier subconjunto de campos; la UI sigue mandando solo `content`.
- Compartir, guardar y borrar se deshabilitan en los snippets compartidos (`relation = shared`).
- La ejecución corre la versión guardada del snippet, no lo que hay en el editor.
- La descarga (US-13) la arma el Snippet Service (`/snippets/{id}/download`): el original o la versión formateada con las reglas del usuario, que existe recién después de cambiar una regla de formato (si no, avisa que todavía no hay).

## CI

`.github/workflows/ci.yml` corre lint, tests y build con el dev shell de Nix en cada pull request y en cada push a `dev` y `prod`.

`.github/workflows/publish-image.yml`, en cada push a `dev` y `prod`, publica la imagen en GHCR (`ghcr.io/<owner>/printscript-ui:<rama>` y `:<rama>-<sha>`) y dispara el despliegue de esa rama en `snippet-searcher-infra`. Las variables de build salen de las variables del repo (`AUTH0_DOMAIN`, `AUTH0_SPA_CLIENT_ID`, `AUTH0_AUDIENCE`); el secreto `DEPLOY_PAT` es un token clásico con el scope `repo`.
