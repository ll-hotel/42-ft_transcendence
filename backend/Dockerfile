FROM node:22-alpine

WORKDIR /srv/app

RUN apk add --no-cache tini

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ src/
RUN npm run build



ENTRYPOINT [ "tini", "--" ]
CMD [ "node", "dist/index.js" ]
