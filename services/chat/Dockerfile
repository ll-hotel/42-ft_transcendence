FROM oven/bun:1.3.8-alpine AS builder

WORKDIR /srv/app
RUN apk add typescript;
COPY src/ src/
COPY package.json .
COPY tsconfig.json .
RUN bun install
RUN tsc;

FROM node:22-alpine

WORKDIR /srv/app
COPY --from=builder /srv/app/dist dist/
COPY --from=builder /srv/app/node_modules node_modules
COPY package.json .

CMD [ "node", "dist/main.js" ]
