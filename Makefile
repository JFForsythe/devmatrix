PORT ?= 8787
NODE ?= node
CHECK_ARGS ?=
VERIFY_ARGS ?=

.PHONY: help check test-checker ship verify-live install-hooks portal

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

check: test-checker ## Run the complete local/CI validation gate
	@$(NODE) scripts/check-repo.mjs $(CHECK_ARGS)

test-checker: ## Run the repository tooling self-tests
	@$(NODE) --test scripts/*.test.mjs

ship: ## Check, commit, push, deploy, and verify exact files from SHIP_* env
	@$(NODE) scripts/ship.mjs

verify-live: ## Verify production matches the clean, pushed commit
	@$(NODE) scripts/verify-live.mjs $(VERIFY_ARGS)

install-hooks: ## Enable the tracked pre-commit validation hook
	@git config --local core.hooksPath .githooks
	@echo "Installed .githooks/pre-commit"

portal: ## Serve the Console prototype at http://localhost:$(PORT)
	@echo "Console prototype → http://localhost:$(PORT)"
	@cd portal/prototype && python3 -m http.server $(PORT)
