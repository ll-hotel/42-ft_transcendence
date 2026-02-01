#!/bin/bash

ELASTIC_HOST="https://elasticsearch:9200"
CERT="--cacert /var/certs/certificate.pem"

count=60
for i in $(seq $count); do
	if [[ $(curl -s -o /dev/null -w "%{http_code}" $CERT -u $ELASTIC_USERNAME:$ELASTIC_PASSWORD $ELASTIC_HOST) == 200 ]]; then
		break
	fi
	echo "INFO: Waiting for Elasticsearch to respond..."
	sleep 2
done

if [[ $(curl -s -o /dev/null -w "%{http_code}" $CERT -u $ELASTIC_USERNAME:$ELASTIC_PASSWORD $ELASTIC_HOST) != 200 ]]; then
	echo "ERROR: Unable to join Elasticsearch host"
	exit 1;
fi

echo "INFO: Checking configuration status..."
if [[ $(curl -s -o /dev/null -w "%{http_code}" $CERT -u $KIBANA_USERNAME:$KIBANA_PASSWORD $ELASTIC_HOST/_security/_authenticate) == 200 ]]; then
	echo "INFO: Kibana visualisation user already present"
	echo "INFO: Configuration already done. Exiting with sucess..."
	exit 0
fi

echo "INFO: Creating kibana_admin user (named $KIBANA_USERNAME)"
if [[ $(curl -s -o /dev/null -w "%{http_code}" $CERT -u $ELASTIC_USERNAME:$ELASTIC_PASSWORD -X POST -H "Content-Type: application/json" $ELASTIC_HOST/_security/user/$KIBANA_USERNAME -d "{ \"password\" : \"$KIBANA_PASSWORD\", \"roles\" : [\"kibana_system\", \"kibana_admin\", \"viewer\"], \"full_name\" : \"Log management\" }") != 200 ]]; then
	echo "ERROR: Unable to create kibana_admin (named $KIBANA_USERNAME) user"
	exit 4;
fi

echo "INFO: Configuration done. Exiting with sucess..."
exit 0
