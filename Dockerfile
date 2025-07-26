FROM alpine:3

RUN apk update
RUN apk upgrade

RUN apk add nodejs npm
RUN apk add typescript

WORKDIR /srv
COPY package.json tsconfig.json .
COPY node_modules/ node_modules
COPY src/ src
COPY www/ www

RUN mkdir -p www

RUN tsc

ENTRYPOINT [ "node", "." ]
# CMD [ "tail", "-f" ]
