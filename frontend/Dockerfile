FROM nginx:alpine
RUN apk add tini;
RUN apk add nodejs npm typescript;
RUN apk add nginx;

WORKDIR /srv/app

COPY package.json ./
RUN npm install;
COPY tsconfig.json ./
COPY init.sh ./
RUN chmod a+x ./init.sh;

COPY nginx.conf /etc/nginx

ENTRYPOINT [ "tini", "--" ]
CMD [ "sh", "./init.sh" ]
