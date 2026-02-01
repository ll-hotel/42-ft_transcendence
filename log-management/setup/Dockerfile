FROM alpine:3.21

RUN apk add --no-cache curl bash

COPY init.sh /usr/local/bin/startup.sh
RUN chmod +x /usr/local/bin/startup.sh

ENTRYPOINT ["/usr/local/bin/startup.sh"]
