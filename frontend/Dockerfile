FROM node:22-alpine
WORKDIR /srv/app

COPY package.json tsconfig.json ./
RUN npm install;

COPY src/ src/
ENTRYPOINT [ "tsc" ]


FROM nginx:alpine
RUN apk add tini;

WORKDIR /srv/app

COPY nginx.conf /etc/nginx
COPY server.conf /etc/nginx/conf.d/

ENTRYPOINT [ "tini", "--" ]
CMD [ "nginx", "-g", "daemon off;" ]
