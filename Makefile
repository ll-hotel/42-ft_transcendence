COMPOSE := docker compose
COMPOSE_FILE := docker-compose.yaml
# COMPOSE_PROJECT_NAME := ft_transcendence
export COMPOSE COMPOSE_FILE COMPOSE_PROJECT_NAME

SERVICES := $(shell docker compose config --services | sed 's/^/DNS:/' | paste -sd ',' -)

all: up

up: volume_path certificate build
	$(COMPOSE) up --detach

volume_path:
	@mkdir -p ./database
	@mkdir -p ./uploads

certificate: certificate/privatekey.pem certificate/certificate.pem
certificate/privatekey.pem certificate/certificate.pem:
	@mkdir -p $(dir $@)
	@openssl req -newkey rsa:2048 -nodes -keyout certificate/privatekey.pem -x509 -days 365 -out certificate/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:localhost,$(SERVICES)" 2>/dev/null
	@chmod 644 certificate/*	# Very important for grafana and prometheus because they run as own user
	@echo "=> New certs has been generated"

build:
	$(COMPOSE) build

down:
	$(COMPOSE) down --timeout 2

ps:
	$(COMPOSE) ps

.PHONY: all up certificate build down ps
