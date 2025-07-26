.PHONY: all
all: up

.PHONY: up
up: build
	docker compose up --detach

.PHONY: build
build:
	docker compose build

.PHONY: down
down:
	docker compose down --timeout 2

.PHONY: ls
ls:
	docker compose ls --all

.PHONY: re
re: down
	@$(MAKE) --no-print-directory up
	@$(MAKE) --no-print-directory ls
