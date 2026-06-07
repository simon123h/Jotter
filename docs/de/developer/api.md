# REST-API und OpenAPI-Referenz

Jotter wird von einem leichtgewichtigen REST-API-Server begleitet, der in Go geschrieben ist. Diese API steuert die Frontend-Webanwendung und ermöglicht es Entwicklern, eigene Skripte, Browser-Erweiterungen oder Terminal-Hooks zu schreiben, um programmatisch mit ihren Taskboards zu interagieren.

Diese Seite beschreibt den Standard-API-Port, die Endpunktstruktur, die automatische Dokumentation und Beispiele für die Nutzung der API.

---

## Server-Port und Konfiguration

Wenn du Jotter im Servermodus startest, bindet sich der Backend-Dienst standardmäßig an einen voreingestellten, hohen Port:

* **Standard-URL**: `http://localhost:58271`
* **Port-Konfiguration**: Der Port kann beim Start angepasst werden, indem du den Parameter `--port` an das Binary übergibst oder die Umgebungsvariable `PORT` setzt.

```bash
./jotter-server --port 8080
```

---

## Swagger UI und interaktive Dokumentation

Jotter verfügt über eine interaktive, automatisch generierte OpenAPI-Dokumentation und die integrierte Swagger UI.

* **Swagger UI Playground**: Du erreichst die interaktive Oberfläche direkt über deinen Browser unter:
  `http://localhost:58271/swagger/index.html`
* **Rohe OpenAPI-JSON-Spezifikation**: Das rohe OpenAPI v2 (Swagger) Dokument kann abgerufen werden unter:
  `http://localhost:58271/swagger/doc.json`

Über das Swagger UI kannst du API-Abfragen live im Browser ausführen, payloads testen und die strukturierten JSON-Rückgaben einsehen.

---

## Wichtige API-Endpunkte

Die API ist um Standard-CRUD-Operationen für Projekte, Spalten (Buckets) und Aufgabenkarten herum aufgebaut. Alle Abfragen liefern und erwarten strukturierte JSON-Inhalte.

### Projekte
* `GET /api/v1/projects` - Listet alle aktiven Projekte im Arbeitsbereich auf.
* `POST /api/v1/projects` - Erstellt ein neues Projektverzeichnis.
* `PUT /api/v1/projects/{projectId}` - Bearbeitet Projektdetails oder benennt das Projekt um.
* `DELETE /api/v1/projects/{projectId}` - Löscht ein Projekt samt allen darin enthaltenen Aufgaben.

### Aufgaben (Tasks)
* `GET /api/v1/projects/{projectId}/tasks` - Listet alle Aufgabenkarten eines bestimmten Projekts auf.
* `GET /api/v1/tasks/{taskId}` - Ruft die detaillierten Metadaten und die Beschreibung einer einzelnen Aufgabe ab.
* `POST /api/v1/tasks` - Erstellt eine neue Aufgabe (schreibt in Echtzeit eine entsprechende `.md`-Datei im Projektordner).
* `PUT /api/v1/tasks/{taskId}` - Aktualisiert Aufgabendetails, Tags, Checklistenstände oder die Beschreibung.
* `DELETE /api/v1/tasks/{taskId}` - Löscht eine Aufgabe (entfernt die `.md`-Datei physisch von der Festplatte).

### System und Synchronisation
* `POST /api/v1/sync` - Triggert manuell eine vollständige Neusynchronisation des Dateisystems, um alle Markdown-Dateien in den SQLite-Index einzupflegen.
* `GET /api/v1/health` - Prüft den Online-Status des API-Servers.

---

## Codebeispiel zur API-Integration

Da die API Standard-JSON-Payloads verwendet, lassen sich Workflows spielend leicht automatisieren.

### Eine Aufgabe per curl erstellen
Folgendes Beispiel zeigt, wie du eine neue Aufgabe im Standardprojekt direkt aus deinem Terminal heraus erstellst:

```bash
curl -X POST http://localhost:58271/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "default",
    "title": "Automatisierte Aufgabe per Shell-Skript",
    "bucket": "todo",
    "priority": "medium",
    "tags": ["automation", "cli"],
    "body": "Diese Aufgabenkarte wurde vollautomatisch bei einem Git-Push generiert."
  }'
```

Sobald dieser Befehl erfolgreich ausgeführt wird:
1. Schreibt Jotter im Hintergrund eine neue `.md`-Datei mit einer eindeutigen ID im `tasks`-Ordner.
2. Der SQLite-Index wird in Echtzeit aktualisiert.
3. Die Karte erscheint sofort im Web-Interface in der Spalte "To Do".
