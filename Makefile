COMPOSE_FILE := docker-compose.yaml
COMPOSE_PROJECT_NAME := ft_transcendence
COMPOSE := docker compose

export COMPOSE_FILE COMPOSE_PROJECT_NAME

.PHONY: all
all: up

.PHONY: up
up: secrets dbDir
	$(COMPOSE) up --build --detach

.PHONY: secrets
secrets: secrets/privatekey.pem secrets/certificate.pem

dbDir:
	@mkdir -p ./backend/db

secrets/privatekey.pem secrets/certificate.pem:
	@mkdir -p $(dir $@)
	openssl req -newkey rsa:2048 -nodes -keyout secrets/privatekey.pem -x509 -days 365 -out secrets/certificate.pem

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
