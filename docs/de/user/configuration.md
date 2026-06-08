# Jotter konfigurieren

Du kannst anpassen, wie Jotter ausgeführt wird (z. B. den Netzwerk-Port ändern oder festlegen, wo deine Aufgabendateien gespeichert werden). Dies ist über Kommandozeilenargumente, Umgebungsvariablen oder eine Konfigurationsdatei möglich.

---

## Konfigurations-Eigenschaften

| Einstellung | CLI-Option | Konfig-Schlüssel | Umgebungsvariable | Standardwert | Beschreibung |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Port** | `--port <nummer>` | `port: <nummer>` | _N/A_ | `58271` | Der Netzwerk-Port, auf dem der Server lauscht. |
| **Host** | `--host <adresse>` | `host: "<adresse>"` | _N/A_ | `127.0.0.1` | Die Host-IP-Adresse, an die sich der Server bindet (z. B. `0.0.0.0`, um Zugriff aus dem lokalen Netzwerk zu erlauben). |
| **Datenverzeichnis** | `--data-dir <pfad>` | `data_dir: "<pfad>"` | `JOTTER_DATA_DIR` | _Siehe Speicherorte_ | Der Ordner, in dem deine Markdown-Aufgaben gespeichert werden. Unterstützt `~` zur Pfadauflösung des Home-Verzeichnisses. |
| **Log-Verzeichnis** | _N/A_ | `log_dir: "<pfad>"` | `JOTTER_LOG_DIR` | _Siehe Speicherorte_ | Das Verzeichnis, in dem Jotter die Datei `jotter.log` speichert. Getrennt von den Notizen, um Git-Konflikte zu vermeiden. |
| **Log-Level** | `--log-level <level>` | `log_level: "<level>"` | `JOTTER_LOG_LEVEL` | `info` (Dev) / `warning` (Prod) | Detailtiefe der Log-Ausgaben (`debug`, `info`, `warning`, `error`, `critical`). |
| **Konfig-Datei** | `--config <pfad>` / `-c` | _N/A_ | _N/A_ | _Siehe Speicherorte_ | Gibt den Pfad zu einer benutzerdefinierten YAML- oder JSON-Konfigurationsdatei an. Wird automatisch erstellt, wenn sie fehlt. |

---

## Speicherorte (Portabler Modus vs. Standardverzeichnisse)

Jotter ist extrem flexibel und kann entweder als vollständig eigenständige **portable App** oder als global installierte Standardanwendung ausgeführt werden.

### 1. Portabler Modus (Eigenständig)

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

Diese Datei ist von deinem Markdown-Datenverzeichnis isoliert, sodass sie von der automatischen Git-Synchronisation nicht erfasst oder hochgeladen wird.

### Log-Rotation
Um lokalen Speicherplatz zu sparen, begrenzt Jotter die Größe der Datei `jotter.log` automatisch. Wenn die Datei beim Starten von Jotter größer als **5 MB** ist, wird sie gelöscht und ein neues, leeres Log-File angelegt.

---

## Automatische Erstellung der Konfiguration

Um die Ersteinrichtung so mühelos wie möglich zu machen, **erstellt Jotter automatisch eine vorkonfigurierte Standarddatei**, falls am Zielort keine Konfigurationsdatei existiert (entweder am Pfad für die `Standard-Konfigurationsdatei` oben oder lokal unter `./jotter.yaml` im portablen Modus).

Die erstellte Datei enthält die Parameter als auskommentierte Vorlagen, die sofort angepasst werden können:

```yaml
# Jotter Configuration File
# data_dir: ""
# log_dir: ""
# host: "127.0.0.1"
# port: 58271
# log_level: "INFO"
```

---

## Priorität der Konfigurationseinstellungen

Jotter wertet die Einstellungen in folgender Reihenfolge aus (höhere Priorität überschreibt niedrigere):

1. **Kommandozeilenparameter** (z. B. `--port 9000`)
2. **Umgebungsvariablen** (z. B. `JOTTER_DATA_DIR`)
3. **Geladene Konfigurationsdatei** (`jotter.yaml`/`jotter.yml`/`jotter.json`)
4. **Standardpfade** (Portabler Fallback bei existierendem `tasks`-Ordner, andernfalls Systemspezifische Pfade)

---

## Beispiele für die Kommandozeile

* **Auf einem benutzerdefinierten Port ausführen:**

  ```bash
  ./jotter-server --port 8080
  ```

* **Markdown-Aufgaben in einem anderen Ordner speichern:**

  ```bash
  ./jotter-server --data-dir ~/Documents/kanban-tasks
  ```

* **Eine bestimmte Konfigurationsdatei laden:**
  ```bash
  ./jotter-server --config /etc/jotter/config.yaml
  ```

---

## Git-Synchronisation

Jotter unterstützt eine integrierte Git-Synchronisation **auf Projektbasis**. Dies ermöglicht es dir, einige Projekte privat (nur lokal) zu halten, während du andere über verschiedene Git-Remotes (GitHub, GitLab etc.) teilst.

### Aktivierung:

1. Öffne die **Projekteinstellungen**, indem du auf das Stift-Symbol neben einem Projektnamen in der Seitenleiste klickst.
2. Trage deine **Git-Remote-URL** (z. B. `https://github.com/user/repo.git`) in das Feld ein und klicke auf **Speichern**.
3. Ein Git-Symbol erscheint neben dem Projektnamen in der Seitenleiste und signalisiert, dass das Projekt nun Git-unterstützt ist.
4. Stelle sicher, dass deine Git-Anmeldedaten lokal hinterlegt sind (z. B. über einen SSH-Agenten oder Credential-Helper), da Jotter Git-Befehle im Hintergrund ausführt.

### Synchronisations-Verhalten:

Wenn du auf die Schaltfläche **Synchronisieren** in der Fußzeile der Seitenleiste klickst, arbeitet Jotter alle Projekte mit eingerichteter Remote-URL nacheinander ab:

* **Auto-Initialisierung**: Falls der Projektordner noch kein Git-Repository ist, führt Jotter automatisch `git init` aus und verbindet das Remote.
* **Commit**: Lokale Änderungen in diesem Projekt werden mit einem Zeitstempel committed.
* **Merge**: Jotter holt Remote-Änderungen ab und führt sie zusammen (`git pull --rebase`). Tritt ein **Merge-Konflikt** auf, bricht Jotter den Vorgang ab, um deine Dateien zu schützen, und gibt einen Fehler im Terminal aus.
* **Push**: Erfolgreich zusammengeführte Stände werden an das Remote gepusht.
* **Datenbank-Update**: Der interne Suchindex wird für alle Projekte aktualisiert.
