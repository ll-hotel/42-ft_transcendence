COMPOSE_FILE := docker-compose.yaml
# COMPOSE_PROJECT_NAME := ft_transcendence
COMPOSE := docker compose

export COMPOSE_FILE COMPOSE_PROJECT_NAME

.PHONY: all
all: up

.PHONY: up
up: cert dbDir uploadsDir
	$(COMPOSE) up --build --detach

.PHONY: cert
cert: cert/privatekey.pem cert/certificate.pem

dbDir:
	@mkdir -p ./database
uploadsDir:
	@mkdir -p ./frontend/static/uploads

cert/privatekey.pem cert/certificate.pem:
	@mkdir -p $(dir $@)
	@openssl req -newkey rsa:2048 -nodes -keyout cert/privatekey.pem -x509 -days 365 -out cert/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:localhost" 2>/dev/null
	@echo "=> New certs has been generated"

.PHONY: services-cert
services-cert: services/tournament/cert services/game/cert services/queue/cert services/chat/cert 

.PHONY: services/tournament/cert
services/tournament/cert:
	@mkdir -p $@
	@openssl req -newkey rsa:2048 -nodes -keyout $@/privatekey.pem -x509 -days 365 -out $@/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:tournament-service" 2>/dev/null

.PHONY: services/game/cert
services/game/cert:
	@mkdir -p $@
	@openssl req -newkey rsa:2048 -nodes -keyout $@/privatekey.pem -x509 -days 365 -out $@/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:game-service" 2>/dev/null

.PHONY: services/queue/cert
services/queue/cert:
	@mkdir -p $@
	@openssl req -newkey rsa:2048 -nodes -keyout $@/privatekey.pem -x509 -days 365 -out $@/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:queue-service" 2>/dev/null

.PHONY: services/chat/cert
services/chat/cert:
	@mkdir -p $@
	@openssl req -newkey rsa:2048 -nodes -keyout $@/privatekey.pem -x509 -days 365 -out $@/certificate.pem \
		-subj "/CN=internal" -addext "subjectAltName=DNS:chat-service" 2>/dev/null

.PHONY: build
build:
	$(COMPOSE) build

.PHONY: down
down:
	$(COMPOSE) down --timeout 2

.PHONY: ps
ps:
	$(COMPOSE) ps

.PHONY: tailwind
tailwind: up
	docker exec -it frontend npx tailwindcss -i src/input.css -o static/tailwind.css
