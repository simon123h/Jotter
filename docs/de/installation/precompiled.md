# Installation & Schnellstart

Jotter ist eine leichtgewichtige, lokale Webanwendung, die auf Python (FastAPI) und einem Vue 3-Frontend basiert.

---

## Voraussetzungen

- **Python 3.10+** und **pip**
- Ein moderner Webbrowser (Chrome, Firefox, Safari, Edge)

---

## Option 1: Schnellstart mit `pipx` (Empfohlen für Python-Nutzer)

Führe Jotter direkt über PyPI aus, ohne ein Git-Repository zu klonen oder virtuelle Umgebungen manuell zu verwalten:

```bash
pipx run jotter-app
```

Oder in einer isolierten globalen Umgebung installieren:
```bash
pipx install jotter-app
jotter
```

---

## Option 2: Eigenständige Binärdatei (Kein Python erforderlich)

Falls du kein Python installiert hast, kannst du eine vorkompilierte Einzeldatei (`jotter-server`) direkt von den [GitHub Releases](https://github.com/simon123h/jotter/releases) herunterladen:

- **Windows**: `jotter-server-windows-amd64.zip` herunterladen, entpacken und `jotter-server.exe` per Doppelklick starten.
- **Linux**: `jotter-server-linux-amd64.tar.gz` herunterladen, entpacken und `./jotter-server` ausführen.
- **macOS**: `jotter-server-darwin-amd64.tar.gz` herunterladen, entpacken und `./jotter-server` ausführen.

Dein Standard-Webbrowser öffnet sich automatisch unter `http://localhost:58271`. Verwende `--no-browser`, falls du Jotter auf einem Headless-Server betreibst.

---

## Offline-Installation (`.whl`)

Auf isolierten Systemen ohne Internetzugang kann die Wheel-Datei (`jotter_app-*.whl`) direkt von den [GitHub Releases](https://github.com/simon123h/jotter/releases) heruntergeladen und installiert werden:

```bash
pip install ./jotter_app-3.0.0-py3-none-any.whl
jotter
```

---

## Aus dem Quellcode ausführen

1. Repository klonen:
   ```bash
   git clone https://github.com/simon123h/jotter.git
   cd jotter
   ```

2. Python-Abhängigkeiten installieren:
   ```bash
   pip install -e .
   ```

3. Server starten:
   ```bash
   jotter
   # oder: python3 run.py
   ```

4. Öffne deinen Webbrowser unter **`http://localhost:58271`**.

---

## Konfigurationsmodi

Jotter unterstützt sowohl portable als auch globale Speicherorte:

- **Portabler Modus**: Wenn im aktuellen Verzeichnis ein Ordner `tasks/` existiert, werden Aufgaben standardmäßig in `./tasks` und die Konfiguration in `./jotter.yaml` abgelegt.
- **Globaler Modus**: Andernfalls nutzt Jotter die Standard-Verzeichnisse des Betriebssystems (XDG-Pfade unter Linux, AppData unter Windows, Application Support unter macOS).
- **Automatische Vorlagenerstellung**: Falls beim Start keine Konfigurationsdatei vorhanden ist, wird automatisch eine kommentierte Vorlage `jotter.yaml` am Standardspeicherort erstellt.

Weitere Details findest du im [Konfigurationshandbuch](/de/user/configuration).
