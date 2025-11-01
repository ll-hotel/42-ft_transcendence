FROM nginx:alpine
RUN apk add tini;
RUN apk add nodejs npm typescript;
RUN apk add nginx;

WORKDIR /srv/app

COPY nginx.conf /etc/nginx
COPY tsconfig.json ./
COPY init.sh ./
RUN chmod a+x ./init.sh;

ENTRYPOINT [ "tini", "--" ]
CMD [ "sh", "./init.sh" ]
