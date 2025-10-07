COMPOSE_FILE := docker-compose.yaml
COMPOSE_PROJECT_NAME := ft_transcendence
COMPOSE := docker compose

export COMPOSE_FILE COMPOSE_PROJECT_NAME

.PHONY: all
all: up

.PHONY: up
up:
	$(COMPOSE) up --build --detach

.PHONY: down
down:
	$(COMPOSE) down --timeout 2

.PHONY: ps
ps:
	$(COMPOSE) ps
