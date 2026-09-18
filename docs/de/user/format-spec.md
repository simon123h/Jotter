# Markdown-Spezifikation

Jotter basiert auf der Philosophie, dass einfache Markdown-Dateien die einzige Quelle der Wahrheit darstellen. Jede Aufgabe wird als eigene `.md`-Datei im Unterverzeichnis `tasks` deines Projekts abgelegt. Du kannst diese Dateien mit jedem herkömmlichen Texteditor, Markdown-Programm oder Versionskontrollsystem öffnen, lesen, bearbeiten und sichern.

Diese Seite dokumentiert das genaue Schema und die Syntax, die Jotter zum Speichern und Lesen von Aufgaben verwendet.

---

## Dateistruktur

Each task file consists of two main sections:
1. **Frontmatter**: Ein YAML-Block, der von dreifachen Bindestrichen `---` am Anfang der Datei umschlossen ist und die Metadaten der Aufgabe gemäß dem Open Knowledge Format (OKF) enthält.
2. **Inhalt (Body)**: Der Standard-Markdown-Inhalt, der die Aufgabendetails, Notizen, Checklisten und Beschreibungen enthält.

Hier ist ein Beispiel einer vollständigen, gültigen Aufgabendatei:

```markdown
---
type: task
id: 01HJKM7ST89AB234CDEFGHJKMN
project_id: default
title: Sidebar-Dokumentationslinks implementieren
status: in-progress
position: 1024.5
tags:
  - frontend
  - dokumentation
attachments:
  - uploads/design_mockup.png
due_date: "2026-06-15"
planned_date: "this-week"
priority: high
color: "#3b82f6"
postponed_until: "2026-07-09"
created_at: "2026-06-07T12:00:00Z"
updated_at: "2026-06-07T14:30:00Z"
---

Diese Aufgabe erfasst die Implementierung des Hyperlinks zur gehosteten Dokumentation direkt in der Jotter-Seitenleiste.

### Unteraufgaben
- [x] Lokalisierte Übersetzungsschlüssel in Englisch und Deutsch erstellen
- [ ] Einheitliche Designs mit Einstellungen implementieren
- [ ] Unit-Tests für mobile Layouts hinzufügen

### Implementierungshinweise
Der Hyperlink sollte auf `https://simon123h.github.io/Jotter/` zeigen und das `BookOpen`-Symbol verwenden.
```

---

## Aufgaben-Frontmatter-Schema

Der YAML-Frontmatter-Block unterstützt die folgenden Schlüssel-Wert-Paare. Alle Schlüsselnamen sind case-sensitive und müssen kleingeschrieben werden. Benutzerdefinierte oder unbekannte Frontmatter-Schlüssel aus anderen PKM-Tools oder KI-Agenten bleiben sicher erhalten.

| Feld | Typ | Erforderlich | Beschreibung |
| :--- | :--- | :--- | :--- |
| `type` | String | Nein | OKF-Entitätstyp. Wird als `task` serialisiert. |
| `id` | String | Ja | Eine eindeutige, URL-sichere Kennung (ULID oder UUID), die diese Aufgabe im gesamten System eindeutig identifiziert. |
| `project_id` | String | Ja | Die ID des Projekts, zu dem diese Aufgabe gehört. Standardwert ist `default`. |
| `title` | String | Ja | Der Titel der Aufgabe. Sollte einzeilig bleiben. |
| `status` | String | Ja | Der Slug (Name) der Spalte, in der sich die Aufgabe befindet (z. B. `backlog`, `todo`, `in-progress`, `done`). Hinweis: Das bisherige Feld `bucket:` wird zur Abwärtskompatibilität vollständig unterstützt. |
| `position` | Float | Ja | Eine Fließkommazahl, die vom Drag-and-Drop-System verwendet wird, um die Sortierreihenfolge innerhalb einer Spalte zu halten. |
| `tags` | String-Array | Nein | Eine Liste von Begriffen zur Kategorisierung der Aufgabe. Tags werden automatisch kleingeschrieben. |
| `attachments` | String-Array | Nein | Relative Dateipfade für hochgeladene Dateien, die mit dieser Aufgabe verknüpft sind (gespeichert im Projektordner). |
| `due_date` | String | Nein | Das Fälligkeitsdatum im ISO-Format `YYYY-MM-DD` (oder `null`, wenn keines vorhanden ist). |
| `planned_date`| String | Nein | Planungsmarker für die Wochenplanung. Unterstützte Werte: `today`, `tomorrow`, `this-week`, `this-month`, `this-year`, `sometime-maybe` oder `null`. |
| `priority` | String | Nein | Die Priorität der Aufgabe. Unterstützte Werte: `low`, `medium`, `high`, `urgent` oder `null`. |
| `color` | String | Nein | Ein benutzerdefinierter Hex-Farbcode (z. B. `#ef4444`) zur visuellen Hervorhebung der Aufgabenkarte. |
| `postponed_until` | String | Nein | Das Datum, bis zu dem die Aufgabe aufgeschoben ist, im ISO-Format `YYYY-MM-DD` (oder `null`, wenn keines vorhanden ist). |
| `created_at` | String | Ja | ISO 8601 UTC-Zeitstempel der Erstellung (z. B. `2026-06-07T12:00:00Z`). |
| `updated_at` | String | Ja | ISO 8601 UTC-Zeitstempel der letzten Änderung. |

---

## Projekt-Manifest-Spezifikation (`index.md`)

Jedes Projektverzeichnis in Jotter wird durch eine `index.md`-Datei direkt im Projektordner definiert (z. B. `<data_dir>/<project_id>/index.md`). Diese Datei dient gleichzeitig als kanonisches Projekt-Manifest (definiert Spalten/Buckets und Metadaten) sowie als vollwertige Markdown-Notiz, die mit Obsidian Folder Notes, Logseq Namespaces und PKM-Systemen kompatibel ist.

### Beispiel `index.md`

```markdown
---
type: project
id: default
title: Hauptprojekt-Board
description: Primäres Aufgaben-Board für die Entwicklung.
done_clean_period: 7
buckets:
  - name: backlog
    title: Backlog
    position: 0.0
    is_default: false
  - name: todo
    title: Zu erledigen
    position: 1000.0
    is_default: false
  - name: in-progress
    title: In Bearbeitung
    position: 2000.0
    is_default: false
  - name: done
    title: Erledigt
    position: 3000.0
    is_default: false
---

# Hauptprojekt-Übersicht

Willkommen in der Dokumentations-Notiz des Projekt-Boards. Du kannst diesen Markdown-Inhalt frei in Obsidian oder jedem beliebigen Texteditor bearbeiten, um Projektziele, Architektur-Entscheidungen oder Links festzuhalten.
```

### Manifest-Frontmatter-Schema

| Feld | Typ | Erforderlich | Beschreibung |
| :--- | :--- | :--- | :--- |
| `type` | String | Nein | OKF-Entitätstyp. Wird als `project` serialisiert. |
| `id` | String | Ja | Eindeutige Projekt-ID, die mit dem Verzeichnisnamen übereinstimmt. |
| `title` | String | Ja | Angezeigter Titel des Projekt-Boards. |
| `description` | String | Nein | Menschenlesbare Beschreibung des Projekts. |
| `done_clean_period` | Integer | Nein | Richtlinie zum automatischen Aufräumen erledigter Aufgaben in Tagen (z. B. `0` für deaktiviert, `1`, `7`, `30` oder `null` für globalen Standard). |
| `buckets` | Array von Objekten | Ja | Liste der Spalten (Buckets), sortiert nach `position`. Jedes Objekt enthält `name` (Slug), `title`, `position`, `color`, `layout`, `max_tasks` und `is_default`. |

> [!NOTE]
> **Lokale vs. geteilte Konfiguration**: Git-Remote-URLs (`git_remote`) pro Projekt werden in der lokalen Repository-Konfiguration (`.git/config` / lokaler SQLite-Index) gespeichert und nicht in `index.md` geschrieben. Dies schützt Zugangsdaten und verhindert Remote-Konflikte bei geteilten Repositories.
>
> **Automatische Migration**: Workspaces mit älteren `projects.json`- oder `buckets.json`-Dateien werden beim Starten oder Synchronisieren automatisch in `index.md`-Dateien migriert.

---

## Inhalt und Markdown-Elemente

Alles unterhalb des zweiten `---` Trennzeichens wird als Inhaltsbeschreibung der Aufgabe behandelt. Jotter interpretiert diesen Bereich mit einem GitHub Flavored Markdown (GFM) kompatiblen Parser.

### Standard-Markdown-Elemente
Du kannst alle üblichen GFM-Elemente verwenden:
* **Überschriften**: `#` bis `######`
* **Formatierung**: Fett (`**text**`), Kursiv (`*text*`), Durchgestrichen (`~~text~~`)
* **Links & Bilder**: Standard-Syntax wie `[Link Text](url)`
* **Code-Blöcke**: Syntax-Hervorhebung durch dreifache Backticks

### Aufgabenlisten und Checklisten
Unteraufgaben, die als Markdown-Checklisten erfasst sind, werden direkt in die Benutzeroberfläche von Jotter eingebunden:
* Unvollständig: `- [ ] Unteraufgabe`
* Erledigt: `- [x] Unteraufgabe`

Wenn du Checkboxen in der Jotter-App anklickst, editiert Jotter die Markdown-Datei direkt im Hintergrund und ändert `[ ]` in `[x]` (und umgekehrt), wobei alle umliegenden Texte exakt beibehalten werden.

---

## Ephemere Datenbank-Synchronisation

Da deine Markdown-Dateien auf der Festplatte die eigentliche Datenbank sind, verfügt Jotter über eine hocheffiziente, automatische Synchronisation:

* **Scan beim Start**: Beim Starten scannt der Backend-Dienst deine Projektordner nach `.md`-Dateien, analysiert deren Frontmatter und aktualisiert einen ephemeren SQLite-Index im App-Daten-Cache deines Benutzers.
* **Dateisystem-Beobachter**: Während Jotter läuft, lauscht ein Hintergrund-Watcher auf Änderungen im Dateisystem. Wenn du eine Datei extern mit einem anderen Editor (z. B. Obsidian) bearbeitest, aktualisiert Jotter die Ansicht in Echtzeit.
* **Manuelle Synchronisation**: Sollte ein Ereignis verpasst werden oder Dateien manuell kopiert worden sein, kannst du jederzeit auf **Synchronisieren** in der Seitenleiste klicken, um den SQLite-Index vollständig sauber neu aufzubauen.
