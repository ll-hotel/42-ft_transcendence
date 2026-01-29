FROM oven/bun:alpine AS builder

WORKDIR /srv/app
RUN apk add typescript;
COPY src/ src/
COPY package.json .
COPY tsconfig.json .
RUN bun install;
RUN tsc;

FROM nginx:alpine

WORKDIR /srv/app
COPY --from=builder /srv/app/js js
COPY nginx.conf /etc/nginx
