# Aus Quellcode ausführen (Entwicklung)

Diese Anleitung führt dich durch die Einrichtung einer lokalen Entwicklungsumgebung, um Jotter auszuführen und zu modifizieren.

---

## Voraussetzungen

Stelle sicher, dass die folgenden Programme auf deinem System installiert sind:

* **Node.js** (v22 oder höher empfohlen) und **npm**
* **Go** (v1.25.0 oder höher)
* **Wails CLI** (optional, erforderlich um die Desktop-App aus dem Quellcode zu bauen):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
* Eine Terminal-Shell (Bash, Zsh, PowerShell)

---

## Einrichtungsschritte

### 1. Repository klonen

```bash
git clone https://github.com/simon123h/jotter.git
cd jotter
```

### 2. Abhängigkeiten installieren

Es gibt ein praktisches Skript im Root-Verzeichnis, um alle Node-Abhängigkeiten (sowohl im Hauptordner als auch im Frontend) und alle Go-Module gleichzeitig zu installieren:

```bash
npm run install:all
```

---

## Im Entwicklungsmodus ausführen

Du kannst Jotter entweder im Browser-/Web-Modus oder als native Wails-Desktop-Anwendung ausführen.

### Option A: Wails Desktop-Modus (Empfohlen)

Um Jotter im Desktop-Entwicklungsmodus auszuführen (öffnet ein interaktives Desktop-Fenster mit Hot-Reload-Unterstützung für Go und Vue):

```bash
npm run dev
# oder direkt
wails dev
```

### Option B: Web- / Server-Modus

Um sowohl den Go REST API-Server als auch das Frontend (Vue 3 / Vite) parallel in deinem Webbrowser mit Hot-Reload auszuführen:

```bash
npm run dev:backend
# und in einem zweiten Terminal:
npm run dev:frontend
```

---

## Workspace-Skripte

Im Root-Verzeichnis stehen dir praktische NPM-Skripte für deinen Entwicklungs-Workflow zur Verfügung:

| Befehl | Beschreibung |
| :--- | :--- |
| `npm run dev` | Standard-Entwicklungsmodus: Startet das Wails-Desktop-Fenster mit Hot-Reload. |
| `npm run build` | Baut sowohl das `jotter-server` als auch das `jotter-desktop` Binary. |
| `npm run build:server` | Baut nur das Server-Binary. |
| `npm run build:desktop` | Baut nur das Desktop-Binary. |
| `npm run test` | Führt sowohl die Backend- (Go test) als auch die Frontend- (Vitest) Tests aus. |
| `npm run lint` | Überprüft die gesamte Codebase auf Code-Styles (Linter). |
| `npm run format` | Formatiert den gesamten Code automatisch. |

Für einzelne Komponenten gilt:

* **Backend-Befehle** können im Root-Verzeichnis ausgeführt werden: `go test -v ./...`, `go vet ./...`, `go fmt ./...` etc.
* **Frontend-Befehle** können im `frontend/` Verzeichnis ausgeführt werden: `npm run dev`, `npm run test`, `npm run lint` etc.
