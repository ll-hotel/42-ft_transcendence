FROM docker.elastic.co/elasticsearch/elasticsearch:9.2.4

ARG ELASTIC_PASSWORD
RUN elasticsearch-keystore create
RUN echo ${ELASTIC_PASSWORD} | elasticsearch-keystore add bootstrap.password

COPY elasticsearch.yml /usr/share/elasticsearch/config/
