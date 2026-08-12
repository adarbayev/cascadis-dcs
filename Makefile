PYTHON ?= python3.11
VENV_PYTHON := .venv/bin/python

.PHONY: setup dev seed-google seed-google-dry-run test test-backend test-frontend build clean

setup:
	$(PYTHON) -m venv .venv
	$(VENV_PYTHON) -m pip install --upgrade pip
	$(VENV_PYTHON) -m pip install './backend[test]'
	npm --prefix dashboard install

dev:
	$(VENV_PYTHON) scripts/dev.py

seed-google:
	PYTHONPATH="$(CURDIR)/backend/src" $(VENV_PYTHON) scripts/seed_google_portfolio.py

seed-google-dry-run:
	PYTHONPATH="$(CURDIR)/backend/src" $(VENV_PYTHON) scripts/seed_google_portfolio.py --dry-run

test: test-backend test-frontend build

test-backend:
	PYTHONPATH="$(CURDIR)/backend/src" $(VENV_PYTHON) -m pytest backend/tests

test-frontend:
	npm --prefix dashboard test

build:
	npm --prefix dashboard run build

clean:
	rm -rf dashboard/dist dashboard/coverage .pytest_cache backend/.pytest_cache
