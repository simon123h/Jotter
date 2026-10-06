# Installation & Schnellstart

Jotter ist eine leichtgewichtige, lokale Webanwendung, die auf Python (FastAPI) und einem Vue 3-Frontend basiert.

---

## Voraussetzungen

- **Python 3.12+** und **pip**
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

## Option 2: Android App (Jotter Lite, .apk)

Jotter Lite ist eine eigenständige, offline-fähige Android-App mit den Kernfunktionen von Jotter (ohne Zeitblöcke, Canvas und Git-Verlauf):

1. Lade `jotter-lite-*-android.apk` von den [GitHub Releases](https://github.com/simon123h/jotter/releases) herunter.
2. Öffne die APK-Datei auf deinem Android-Smartphone zur Installation.
3. Die App speichert alle Aufgaben lokal unter `Documents/Jotter` als reine `.md`-Dateien. Dieser Ordner kann über **Syncthing**, **Git** oder Cloud-Sync nahtlos mit deinem Desktop synchronisiert werden.

---

## Offline-Installation mit Python-Wheel (`.whl`)

Auf isolierten Systemen ohne Internetzugang kann die Wheel-Datei (`jotter_app-*.whl`) direkt von den [GitHub Releases](https://github.com/simon123h/jotter/releases) heruntergeladen und installiert werden:

```bash
pip install ./jotter_app-3.0.0-py3-none-any.whl
jotter
```

---

## Optional: MCP-Server für KI-Assistenten

`jotter mcp` startet einen [Model-Context-Protocol](https://modelcontextprotocol.io)-Server, über den KI-Assistenten mit deinem Board arbeiten können. Dafür wird das optionale Python-Paket `mcp` benötigt, das **nicht** standardmäßig installiert wird. Installiere Jotter mit dem Extra `mcp`:

```bash
pipx install 'jotter-app[mcp]'      # oder zu einer bestehenden Installation hinzufügen: pipx inject jotter-app mcp
pip install 'jotter-app[mcp]'
uvx --from 'jotter-app[mcp]' jotter mcp
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

Jotter nutzt die Standard-Verzeichnisse des Betriebssystems (XDG-Pfade unter Linux, AppData unter Windows, Application Support unter macOS) für Konfiguration und Standard-Vault. Eine `./jotter.yaml` im Startverzeichnis hat Vorrang vor der globalen.

- **Automatische Vorlagenerstellung**: Falls beim Start keine Konfigurationsdatei vorhanden ist, wird automatisch eine kommentierte Vorlage `jotter.yaml` am Standardspeicherort erstellt.

Weitere Details findest du im [Konfigurationshandbuch](/de/user/configuration).
