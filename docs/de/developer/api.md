# REST-API und MCP-Referenz

Jotter bietet sowohl einen leichtgewichtigen FastAPI-Backend-Server als auch einen integrierten **Model Context Protocol (MCP)** Server. Dies ermöglicht es Entwicklern, eigene Skripte, Browser-Erweiterungen oder Terminal-Hooks zu schreiben sowie KI-Assistenten (Claude Desktop, Cursor, Antigravity) direkt mit ihren Kanban-Boards zu verbinden.

---

## Server-Port und Konfiguration

Wenn du Jotter im Servermodus startest, bindet sich der Backend-Dienst standardmäßig an:

* **Standard-URL**: `http://localhost:58271`
* **Port-Konfiguration**: Der Port kann beim Start angepasst werden, indem du den Parameter `--port` übergibst oder die Umgebungsvariable `JOTTER_PORT` setzt:

```bash
jotter --port 8080
```

---

## OpenAPI und interaktive Dokumentation

Jotter verfügt über eine automatisch generierte OpenAPI-Dokumentation direkt im Server:

* **Swagger UI**: `http://localhost:58271/docs`
* **ReDoc**: `http://localhost:58271/redoc`
* **OpenAPI-JSON**: `http://localhost:58271/openapi.json`

---

## Wichtige API-Endpunkte

### Projekte
* `GET /api/projects` - Listet alle aktiven Projekte im Arbeitsbereich auf.
* `POST /api/projects` - Erstellt ein neues Projekt.
* `PUT /api/projects/{id}` - Bearbeitet Projektdetails.
* `DELETE /api/projects/{id}` - Löscht ein Projekt samt allen Aufgaben.

### Spalten / Buckets
* `GET /api/projects/{id}/buckets` - Listet alle Spalten eines Projekts auf.
* `POST /api/projects/{id}/buckets` - Erstellt eine neue Spalte.
* `PUT /api/projects/{id}/buckets/{bucket_name}` - Aktualisiert Spalteneigenschaften (Titel, Farbe, Layout).
* `DELETE /api/projects/{id}/buckets/{bucket_name}` - Löscht eine Spalte.

### Aufgaben (Tasks)
* `GET /api/tasks` oder `GET /api/projects/{id}/tasks` - Listet Aufgaben auf (unterstützt Filter für `bucket`, `tags`, `priority`, `search`, `due_before`, `due_after`).
* `GET /api/projects/{id}/tasks/{taskId}` - Ruft Details und Markdown-Inhalt einer einzelnen Aufgabe ab.
* `POST /api/projects/{id}/tasks` - Erstellt eine neue Aufgabe (schreibt `.md`-Datei auf die Festplatte).
* `PATCH /api/projects/{id}/tasks/{taskId}` - Aktualisiert Aufgabendetails, Priorität, Fälligkeitsdatum oder Beschreibung.
* `PATCH /api/projects/{id}/tasks/{taskId}/move` - Verschiebt eine Aufgabe in eine andere Spalte.
* `DELETE /api/projects/{id}/tasks/{taskId}` - Löscht eine Aufgabe und entfernt deren `.md`-Datei.

### System und Synchronisation
* `POST /api/system/sync` - Gleicht Markdown-Dateien mit dem SQLite-Index ab und führt Git-Sync aus.
* `GET /api/system/info` - Liefert Systeminformationen (Datenverzeichnis, Version, Git-Status).

---

## Model Context Protocol (MCP) Integration

Jotter verfügt über einen integrierten MCP-Server, mit dem KI-Assistenten (Claude Desktop, Cursor, Antigravity usw.) Aufgaben direkt auf dem Board abfragen, erstellen, verschieben und bearbeiten können.

### MCP-Server starten
```bash
jotter mcp
```

### Claude Desktop & Agenten-Konfiguration
Füge Jotter zu deiner `claude_desktop_config.json` bzw. Agenten-Konfiguration hinzu:

```json
{
  "mcpServers": {
    "jotter": {
      "command": "jotter",
      "args": ["mcp"]
    }
  }
}
```

### Verfügbare MCP-Tools

#### Projekt-Operationen
* `list_projects()`: Alle Projekte auflisten (ID, Titel, Beschreibung, Git-Remote).
* `get_project(project_id="default")`: Projektdetails und Einstellungen anhand der ID abrufen.
* `create_project(title, id=None, description=None, git_remote=None)`: Neues Projektboard mit Standardspalten (`todo`, `in-progress`, `done`) erstellen.

#### Spalten- / Bucket-Operationen
* `list_buckets(project_id="default")`: Kanban-Spalten/Buckets für ein Projekt auflisten.
* `create_bucket(title, project_id="default", name=None)`: Neue Kanban-Spalte/Bucket zu einem Projekt hinzufügen.

#### Aufgaben-Operationen
* `list_tasks(...)`: Aufgaben mit flexiblen Filtern abfragen:
  - `project_id: str | None`: Zielprojekt (`None` = Standardprojekt).
  - `bucket: str | None`: Einzelne Spalte (z. B. `"todo"`).
  - `buckets: list[str] | None`: Mehrere Spalten filtern (z. B. `["todo", "in-progress"]`).
  - `include_done: bool = False`: **Standardmäßig (`False`) werden erledigte und archivierte Aufgaben (`done`, `archive`) ausgeschlossen**, um Kontext-Überflutung für KI-Modelle zu verhindern. Auf `True` setzen, um alle Aufgaben einzubeziehen.
  - `exclude_buckets: list[str] | None`: Explizite Ausschlussliste von Spaltennamen.
  - `tag: str | None` / `tags: list[str] | None`: Einzelne oder mehrere Tags filtern.
  - `tag_mode: "any" | "all" = "any"`: Mindestens ein Tag (`any`) oder alle Tags (`all`) erforderlich.
  - `search: str | None`: Volltextsuche in Titeln und Notizen.
  - `priority: "none" | "low" | "medium" | "high" | "urgent" | None`: Nach Priorität filtern.
  - `due_before: str | None` / `due_after: str | None`: Fälligkeitszeitraum (`YYYY-MM-DD`).
  - `planned_date: str | None`: Nach geplantem Datum filtern (`YYYY-MM-DD`).
  - `created_before / created_after / updated_before / updated_after: str | None`: Zeitstempel-Filter (ISO-Format).
  - `limit: int | None`: Maximale Anzahl zurückzugebender Aufgaben.
* `get_task(task_id, project_id="default")`: Vollständige Aufgabendetails und Markdown-Beschreibung abrufen.
* `create_task(title, body="", project_id="default", bucket="todo", tags=None, priority=None, due_date=None, planned_date=None)`: Neue Aufgabe auf dem Board anlegen.
* `batch_create_tasks(tasks, project_id="default")`: Mehrere Aufgaben auf einmal erstellen.
* `update_task(task_id, title=None, body=None, bucket=None, tags=None, priority=None, due_date=None, planned_date=None, project_id="default")`: Metadaten oder Notiztext bearbeiten.
* `move_task(task_id, bucket, position=None, project_id="default", target_project_id=None)`: Aufgabe zwischen Spalten oder über Projekte hinweg verschieben.
* `delete_task(task_id, project_id="default")`: Aufgabe löschen und Markdown-Datei entfernen.

#### Synchronisations-Tools
* `sync_database()`: Dateisystem-Markdown-Dateien mit dem SQLite-Suchindex abgleichen.
* `git_sync()`: Git-Synchronisierung (`add`, `commit`, `pull`, `push`) für konfigurierte Git-Remotes ausführen und SQLite-Index aktualisieren.

---

### Verfügbare MCP-Ressourcen

MCP-Clients können Board-Kontexte direkt und ohne separate Tool-Aufrufe über standardisierte URI-Schemata einbinden:
* `jotter://projects`: Markdown-Übersicht aller Projekte, Beschreibungen und Spaltenstrukturen.
* `jotter://projects/{project_id}/board`: Live-Kanban-Board-Ansicht in Markdown mit Spalten und aktiven Aufgaben inkl. Prioritäten, Fälligkeiten und Tags. **Hinweis**: Die Spalten `done` und `archive` werden automatisch auf eine Aufgabenanzahl zusammengeklappt, um den Kontext schlank zu halten (z. B. `## Done (done) — 42 tasks (collapsed)`).
* `jotter://tasks/{task_id}`: Roher Markdown-Dateiinhalt mit YAML-Frontmatter und Notiztext für eine bestimmte Aufgabe.
* `jotter://projects/{project_id}/tasks/{task_id}`: Roher Markdown-Dateiinhalt für eine bestimmte Aufgabe innerhalb eines definierten Projekts.


