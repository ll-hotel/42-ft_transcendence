FROM nginx:alpine
RUN apk add tini;
RUN apk add nodejs npm typescript;
RUN apk add nginx;

WORKDIR /srv/app

COPY nginx.conf /etc/nginx

# COPY package.json ./
# RUN npm install;

COPY tsconfig.json ./
COPY init.sh /run/init.sh
RUN chmod a+x /run/init.sh;

ENTRYPOINT [ "tini", "--" ]
CMD [ "/run/init.sh" ]
