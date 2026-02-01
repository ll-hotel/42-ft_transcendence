COMPOSE := docker compose
COMPOSE_FILE := docker-compose.yaml
# COMPOSE_PROJECT_NAME := ft_transcendence
export COMPOSE COMPOSE_FILE COMPOSE_PROJECT_NAME

SERVICES := $(shell docker compose config --services | sed 's/^/DNS:/' | paste -sd ',' -)

PASS = $(shell cat /dev/urandom | base32 | head -c 12)


all: up

up: clear_elk volume_path certificate env_file build
	$(COMPOSE) up --detach

volume_path:
	@mkdir -p ./database
	@mkdir -p ./uploads

clear_elk:
	rm -f ./log-management/elasticsearch/elasticsearch.keystore

certificate: certificate/privatekey.pem certificate/certificate.pem
certificate/privatekey.pem certificate/certificate.pem:
	@mkdir -p $(dir $@)
	@openssl req -newkey rsa:2048 -nodes -keyout certificate/privatekey.pem -x509 -days 365 -out certificate/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:localhost,$(SERVICES)" 2>/dev/null
	@chmod 644 certificate/*	# Very important for grafana and prometheus because they run as own user
	@echo "=> New certs has been generated"

env_file: .env
.env:
	@cp .env.example .env
	@echo "" >> .env
	@echo GF_ADMIN_USER=monitoring >> .env
	@echo GF_ADMIN_PASS=$(PASS) >> .env
	@echo ELASTIC_USERNAME=elastic >> .env
	@echo ELASTIC_PASSWORD=$(PASS) >> .env
	@echo KIBANA_USERNAME=log-management >> .env
	@echo KIBANA_PASSWORD=$(PASS) >> .env
	@echo "=> New .env has been generated"

build:
	$(COMPOSE) build

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

.PHONY: all up certificate build down ps
