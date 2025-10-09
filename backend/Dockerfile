FROM node:22-alpine

WORKDIR /srv/app

RUN apk add tini;
RUN apk add typescript;

COPY package.json tsconfig.json ./
RUN npm install;

COPY src/ src/
RUN tsc;

ENTRYPOINT [ "tini", "--" ]
CMD [ "node", "." ]
