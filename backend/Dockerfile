FROM node:22-alpine

WORKDIR /srv/app

RUN apk add tini;
RUN apk add typescript;

COPY package.json ./
RUN npm install;

COPY tsconfig.json ./
COPY init.sh ./init.sh

ENTRYPOINT [ "tini", "--" ]
CMD [ "sh", "./init.sh" ]
