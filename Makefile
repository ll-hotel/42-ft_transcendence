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
	@openssl req -newkey rsa:2048 -nodes -keyout cert/privatekey.pem -x509 -days 365 -out cert/certificate.pem -subj "/CN=internal" -addext "subjectAltName=DNS:localhost" 2>/dev/null
	@echo "=> New certs has been generated"

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
