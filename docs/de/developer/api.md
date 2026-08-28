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

### Claude Desktop Konfiguration
Füge Jotter zu deiner `claude_desktop_config.json` hinzu:

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
* `list_projects`: Alle Projekte auflisten.
* `list_buckets`: Kanban-Spalten für ein Projekt auflisten.
* `list_tasks`: Aufgaben nach Spalte, Tag, Priorität, Datum oder Suchbegriff filtern.
* `get_task`: Vollständige Aufgabendetails und Markdown-Beschreibung abrufen.
* `create_task`: Neue Aufgabe auf dem Board erstellen.
* `update_task`: Metadaten oder Beschreibung einer Aufgabe bearbeiten.
* `move_task`: Aufgabe zwischen Spalten verschieben.
* `delete_task`: Aufgabe löschen.
* `sync_database`: Dateisystem-Markdown-Dateien mit dem Suchindex abgleichen.
