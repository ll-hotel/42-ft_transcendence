FROM nginx:alpine
RUN apk add tini;
RUN apk add nodejs npm typescript;

WORKDIR /srv/app

COPY nginx.conf /etc/nginx

COPY package.json tsconfig.json ./
RUN npm install;

COPY src/ src/
RUN tsc;

ENTRYPOINT [ "tini", "--" ]
CMD [ "nginx", "-g", "daemon off;" ]
