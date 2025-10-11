FROM alpine:3.21

RUN apk add tini;
RUN apk add mariadb;
RUN apk add mariadb-client;

RUN mariadb-install-db --user=mysql --skip-test-db \
	--auth-root-authentication-method=normal \
	--datadir=/var/lib/mysql;

RUN echo >/etc/my.cnf.d/mariadb-server.cnf <<EOF
[mariadb]
bind-address = 0.0.0.0
EOF

RUN mkdir -p /docker-entrypoint-initdb.d;
RUN echo >/docker-entrypoint-initdb.d/init.sql <<EOF
CREATE USER IF NOT EXISTS $DB_USER_NAME@'$DB_USER_HOST' IDENTIFIED BY '$DB_USER_PASSWORD';
CREATE DATABASE IF NOT EXISTS $DB_NAME;
GRANT ALL PRIVILEGES ON $DB_NAME.* TO $DB_USER_NAME@'$DB_USER_HOST';
FLUSH PRIVILEGES;
EOF

RUN mkdir /run/mysqld;
RUN chown mysql /run/mysqld;

ENTRYPOINT [ "tini", "--" ]
CMD [ "mariadbd", "--user=mysql" ]
