FROM alpine:3.21

RUN apk add tini;
RUN apk add mariadb;
RUN apk add mariadb-client;

RUN mariadb-install-db --user=mysql --skip-test-db \
	--auth-root-authentication-method=normal \
	--datadir=/var/lib/mysql;

RUN echo >/etc/my.cnf.d/mariadb-server.cnf "[mariadb]";
RUN echo >>/etc/my.cnf.d/mariadb-server.cnf "bind-address = 0.0.0.0";

ARG DB_NAME
ARG DB_USER_NAME
ARG DB_USER_HOST
ARG DB_USER_PASSWORD

RUN echo >/init.sql "\
CREATE USER IF NOT EXISTS $DB_USER_NAME@'$DB_USER_HOST' IDENTIFIED BY '$DB_USER_PASSWORD';\
CREATE DATABASE IF NOT EXISTS $DB_NAME;\
GRANT ALL PRIVILEGES ON $DB_NAME.* TO $DB_USER_NAME@'$DB_USER_HOST';\
FLUSH PRIVILEGES;\
";

RUN echo >>/init.sh "set -e";
RUN echo >>/init.sh "mariadbd --user=mysql &";
RUN echo >>/init.sh "until mariadb-admin ping --silent --skip-ssl --host=localhost --user=root";
RUN echo >>/init.sh "do sleep 0.1s; done";
RUN echo >>/init.sh "mariadb --user=root < /init.sql;";
RUN echo >>/init.sh "wait";

RUN mkdir /run/mysqld;
RUN chown mysql /run/mysqld;

ENTRYPOINT [ "tini", "--" ]
CMD [ "sh", "/init.sh" ]
