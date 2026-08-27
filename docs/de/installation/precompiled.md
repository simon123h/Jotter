# Installation & Schnellstart

Jotter ist eine leichtgewichtige, lokale Webanwendung, die auf Python (FastAPI) und einem Vue 3-Frontend basiert.

---

## Voraussetzungen

- **Python 3.10+** und **pip**
- Ein moderner Webbrowser (Chrome, Firefox, Safari, Edge)

---

## Schnellstart mit `pipx` (Empfohlen)

Führe Jotter direkt ohne manuelles Klonen oder Bauen aus:

```bash
pipx run jotter-app
```

Oder global installieren:
```bash
pipx install jotter-app
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
