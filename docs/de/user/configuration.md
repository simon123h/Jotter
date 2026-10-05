# Jotter konfigurieren

Du kannst anpassen, wie Jotter ausgeführt wird (z. B. den Netzwerk-Port ändern oder festlegen, wo deine Aufgabendateien gespeichert werden). Dies ist über Kommandozeilenargumente, Umgebungsvariablen oder eine Konfigurationsdatei möglich.

---

## Konfigurations-Eigenschaften

| Einstellung | CLI-Option | Konfig-Schlüssel | Umgebungsvariable | Standardwert | Beschreibung |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Port** | `--port <nummer>` | `port: <nummer>` | _N/A_ | `58271` | Der Netzwerk-Port, auf dem der Server lauscht. |
| **Host** | `--host <adresse>` | `host: "<adresse>"` | _N/A_ | `127.0.0.1` | Die Host-IP-Adresse, an die sich der Server bindet (z. B. `0.0.0.0`, um Zugriff aus dem lokalen Netzwerk zu erlauben). |
| **Log-Verzeichnis** | _N/A_ | `log_dir: "<pfad>"` | `JOTTER_LOG_DIR` | _Siehe Speicherorte_ | Das Verzeichnis, in dem Jotter die Datei `jotter.log` speichert. Getrennt von den Notizen, um Git-Konflikte zu vermeiden. |
| **Log-Level** | `--log-level <level>` | `log_level: "<level>"` | `JOTTER_LOG_LEVEL` | `info` (Dev) / `warning` (Prod) | Detailtiefe der Log-Ausgaben (`debug`, `info`, `warning`, `error`, `critical`). |
| **Log-Farben** | `--no-color` | `use_colors: false` | `NO_COLOR` / `JOTTER_USE_COLORS` | `true` (Auto) | ANSI-Farbausgabe in Terminal-Logs umschalten. Hilfreich, falls ältere Windows-Terminals Escape-Codes (`[32m`) anzeigen. |
| **Konfig-Datei** | `--config <pfad>` / `-c` | _N/A_ | _N/A_ | _Siehe Speicherorte_ | Gibt den Pfad zu einer benutzerdefinierten YAML- oder JSON-Konfigurationsdatei an. Wird automatisch erstellt, wenn sie fehlt. |

---

## Speicherorte (Portabler Modus vs. Standardverzeichnisse)

Jotter ist extrem flexibel und kann entweder als vollständig eigenständige **portable App** oder als global installierte Standardanwendung ausgeführt werden.

### 1. Portabler Modus (Eigenständig)

> **Hinweis:** Vaults verwaltest du in der App (Zahnrad neben der Vault-Auswahl); sie werden in `vaults.json` im Konfigurationsordner gespeichert. Der frühere Konfigurationsschlüssel `data_dir`, die Umgebungsvariable `JOTTER_DATA_DIR` und die Option `--data-dir` werden nicht mehr unterstützt; Schlüssel und Umgebungsvariable werden mit einer Warnung ignoriert.

Wenn sich im aktuellen Arbeitsverzeichnis (CWD), in dem Jotter gestartet wird, ein Ordner namens `tasks/` befindet:

* **Datenverzeichnis** ist standardmäßig `./tasks` (der vorhandene Ordner im aktuellen Verzeichnis).
* **Konfigurationsdatei** wird standardmäßig im selben Verzeichnis als `./jotter.yaml` (oder `./jotter.yml`/`./jotter.json`) gesucht.
* **Log-Verzeichnis** weicht standardmäßig auf die Systemspezifischen Standardpfade aus (unten beschrieben), um zu verhindern, dass Logdateien direkt in deine lokalen Notizen geschrieben werden.

Dieser Modus ist ideal, um Jotter von externen USB-Sticks oder direkt in lokalen Projektordnern auszuführen, ohne Spuren auf dem System zu hinterlassen.

### 2. Standard-Modus (Global)

Wenn kein lokaler `tasks`-Ordner im aktuellen Arbeitsverzeichnis gefunden wird, weicht Jotter auf die folgenden betriebssystemspezifischen Standardpfade aus:

| Betriebssystem | Standard-Datenverzeichnis | Standard-Konfigurationsdatei | Standard-Log-Verzeichnis |
| :--- | :--- | :--- | :--- |
| **Linux** | `~/.local/share/jotter` | `~/.config/jotter/jotter.yaml` | `~/.cache/jotter` |
| **macOS** | `~/Library/Application Support/Jotter` | `~/Library/Application Support/jotter/jotter.yaml` | `~/Library/Logs/Jotter` |
| **Windows** | `%APPDATA%\Jotter` | `%APPDATA%\jotter\jotter.yaml` | `%LocalAppData%\Jotter` |

---

## Logging & Dual-Writer

Jotter verwendet einen **Dual-Writer-Logging-Mechanismus**. Das bedeutet, dass alle Log-Ausgaben (Startup-Informationen, Synchronisationsberichte, Git-Aktivitäten und Systemfehler) sowohl auf die Standardausgabe (`stdout`) ausgegeben als auch an eine persistente lokale Protokolldatei namens `jotter.log` angehängt werden.

Diese Datei ist von deinem Markdown-Datenverzeichnis isoliert, sodass sie von Jotters automatischen Git-Commits nicht erfasst wird.

### Log-Rotation
Um lokalen Speicherplatz zu sparen, begrenzt Jotter die Größe der Datei `jotter.log` automatisch. Wenn die Datei beim Starten von Jotter größer als **5 MB** ist, wird sie gelöscht und ein neues, leeres Log-File angelegt.

---

## Automatische Erstellung der Konfiguration

Um die Ersteinrichtung so mühelos wie möglich zu machen, **erstellt Jotter automatisch eine vorkonfigurierte Standarddatei**, falls am Zielort keine Konfigurationsdatei existiert (entweder am Pfad für die `Standard-Konfigurationsdatei` oben oder lokal unter `./jotter.yaml` im portablen Modus).

Die erstellte Datei enthält die Parameter als auskommentierte Vorlagen, die sofort angepasst werden können:

```yaml
# Jotter Configuration File
# log_dir: ""
# host: "127.0.0.1"
# port: 58271
# log_level: "INFO"
```

---

## Priorität der Konfigurationseinstellungen

Jotter wertet die Einstellungen in folgender Reihenfolge aus (höhere Priorität überschreibt niedrigere):

1. **Kommandozeilenparameter** (z. B. `--port 9000`)
2. **Umgebungsvariablen** (z. B. `JOTTER_PORT`)
3. **Geladene Konfigurationsdatei** (`jotter.yaml`/`jotter.yml`/`jotter.json`)
4. **Standardpfade** (Portabler Fallback bei existierendem `tasks`-Ordner, andernfalls Systemspezifische Pfade)

---

## Beispiele für die Kommandozeile

* **Auf einem benutzerdefinierten Port ausführen:**

  ```bash
  ./jotter-server --port 8080
  ```

* **Eine bestimmte Konfigurationsdatei laden:**
  ```bash
  ./jotter-server --config /etc/jotter/config.yaml
  ```

---

## Git-Versionierung

Ist der Ordner deines Vaults ein Git-Repository, committet Jotter lokale Änderungen, automatisch kurz nach jeder Änderung (höchstens einmal pro Minute) oder sobald du in der Fußzeile der Seitenleiste auf **Commit** klickst. Auf diesen Commits baut die Time Machine auf.

Jotter committet ausschließlich lokal. Ein Repository legt es nur an, wenn du auf **Git aktivieren** klickst, und es führt weder Push noch Pull aus. Details und Hinweise zur Synchronisation über mehrere Geräte findest du unter [Git-Versionierung und Time Machine](./git-sync.md).
