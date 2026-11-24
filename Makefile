COMPOSE := docker compose

.PHONY: dev down logs shell test e2e check build prod reset

dev: ## Lance l'app et Mailpit (http://localhost:3000, mails sur :8025)
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f app

shell:
	$(COMPOSE) exec app sh

test: ## Unitaires, composants (axe) et intégration
	$(COMPOSE) run --rm app bun run test

e2e: ## Scénarios Gherkin dans Chromium
	$(COMPOSE) run --rm app bun run test:e2e

check: ## Lint, types et tests
	$(COMPOSE) run --rm app bun run check

build: ## Image de production
	docker build --target production -t twsb .

prod:
	docker compose -f docker-compose.prod.yml up --build

reset: ## Supprime la base et les médias de dev
	$(COMPOSE) down -v
