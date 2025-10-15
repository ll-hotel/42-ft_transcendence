FROM nginx:alpine
RUN apk add tini;
RUN apk add nodejs npm typescript;
RUN apk add nginx;

WORKDIR /srv/app

COPY nginx.conf /etc/nginx

COPY tsconfig.json ./
COPY src/ src/
RUN tsc;

ENTRYPOINT [ "tini", "--" ]
CMD [ "nginx", "-g", "daemon off;" ]
