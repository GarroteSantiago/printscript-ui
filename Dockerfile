# Build: las variables VITE_* quedan fijas en el bundle
FROM node:22-alpine AS build
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_AUDIENCE
ARG VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_SCOPE
ARG VITE_FAKE_API
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
