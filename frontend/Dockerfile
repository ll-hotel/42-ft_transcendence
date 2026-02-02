FROM oven/bun:1.3.8-alpine AS builder

WORKDIR /srv/app
RUN apk add typescript;
COPY src/ src/
COPY tsconfig.json .
RUN tsc;

COPY static/ static/
COPY package.json .
RUN bun install;
RUN bunx tailwindcss -i src/input.css -o static/tailwind.css;

FROM nginx:alpine3.23

WORKDIR /srv/app
COPY --from=builder /srv/app/js js/
COPY --from=builder /srv/app/static static/
COPY nginx.conf /etc/nginx
