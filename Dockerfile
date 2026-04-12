# Production image: static build + nginx
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Public URL path for Vite `base`: use `/` with this image (nginx serves `dist/` at site root).
# For a subpath, rebuild with the same `VITE_BASE` and serve `dist/` behind a reverse proxy
# that maps that path to `/`, or replace `deploy/nginx.conf` with your own layout.
ARG VITE_BASE=/
ENV VITE_BASE=${VITE_BASE}

RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
