# Aus Quellcode ausführen (Entwicklung)

Diese Anleitung führt dich durch die Einrichtung einer lokalen Entwicklungsumgebung, um Jotter auszuführen und zu modifizieren.

---

## Voraussetzungen

Stelle sicher, dass die folgenden Programme auf deinem System installiert sind:

* **Python** (v3.10 oder höher) und **pip**
* **Node.js** (v20 oder höher empfohlen) und **npm**
* Eine Terminal-Shell (Bash, Zsh, PowerShell)

---

## Einrichtungsschritte

### 1. Repository klonen

```bash
git clone https://github.com/simon123h/jotter.git
cd jotter
```

### 2. Abhängigkeiten installieren

Verwende das Workspace-Skript, um alle Node- und Python-Abhängigkeiten im Entwicklungsmodus zu installieren:

```bash
npm run install:all
```

Oder manuell:

```bash
pip install -e .[dev]
npm install
cd frontend && npm install && cd ..
```

---

## Im Entwicklungsmodus ausführen

Um sowohl das Python-FastAPI-Backend als auch das Vue 3-Frontend mit Hot-Reloading gleichzeitig auszuführen:

```bash
npm run dev
```

Oder in separaten Terminals:

```bash
# Terminal 1: Python Backend
npm run dev:backend
# oder: python3 run.py

# Terminal 2: Frontend
npm run dev:frontend
# oder: cd frontend && npm run dev
```

Das Frontend ist unter `http://localhost:5173` erreichbar (leitet `/api` an das Python-Backend auf Port `58271` weiter).

---

## Tests ausführen

```bash
# Alle Tests ausführen (Pytest + Vitest)
npm run test

# Nur Backend-Tests (Pytest)
npm run test:backend

# Nur Frontend-Tests (Vitest)
npm run test:frontend

# Playwright E2E-Tests
cd frontend && npx playwright test
```
