# Obsidian und PKM-Integration

Da Jotter deine Projekte und Boards als normale Ordner mit einfachen Markdown-Dateien speichert, lässt es sich hervorragend in Personal Knowledge Management (PKM) Tools wie Obsidian, Logseq, Foam oder SilverBullet integrieren.

Du kannst Jotter direkt auf deinen Notizen-Tresor (oder einen Unterordner darin) verweisen lassen, um deine Aufgabenkarten direkt neben deinen Journalen, Wikis und Referenznotizen anzuzeigen und zu verwalten.

---

## Jotter in einem Obsidian-Vault einrichten

Da Obsidian-Vaults (Tresore) einfache lokale Verzeichnisse sind, ist die Integration denkbar einfach.

### Jotter mit deinem Vault verbinden
1. Finde den Speicherort deines Obsidian-Vaults auf deiner Festplatte (z. B. `~/Documents/MeinVault`).
2. Erstelle in deinem Vault einen dedizierten Ordner für Jotter (z. B. `~/Documents/MeinVault/projekte/jotter-board`).
3. Öffne Jotter, erstelle ein neues Projekt (oder bearbeite ein bestehendes) und setze den Projektpfad auf genau diesen Ordner.
4. Jotter erstellt nun seine Aufgaben-Dateien direkt in deinem Vault.

Innerhalb weniger Sekunden siehst du das Verzeichnis `tasks` in deinem Obsidian-Ordner. Alle deine Jotter-Aufgabenkarten erscheinen in Obsidian als ganz normale Notizen!

---

## Kompatibilität der Metadaten (Frontmatter)

Obsidian liest und indiziert YAML-Frontmatter standardmäßig am Anfang von Notizen. Dadurch kannst du Jotter-Aufgaben über Obsidian-Kernfunktionen oder beliebte Community-Plugins filtern.

### Obsidian-Eigenschaften (Properties View)
Die integrierte Eigenschaften-Ansicht von Obsidian erkennt die von Jotter geschriebenen YAML-Metadaten automatisch. Du kannst Felder wie `due_date`, `priority` und `tags` direkt oben in der Notiz als interaktive Widgets bearbeiten.

### Aufgaben abfragen mit Dataview
Mit dem beliebten Community-Plugin **Dataview** kannst du deine Jotter-Aufgaben spielend leicht in Dashboards in deinem gesamten Obsidian-Vault abfragen.

Um beispielsweise alle **wichtigen** (high priority) Aufgaben aufzulisten, die heute oder früher fällig sind, kannst du in eine Obsidian-Notiz schreiben:

```sql
TABLE due_date, priority, bucket
FROM "projekte/jotter-board/tasks"
WHERE priority = "high" AND due_date <= date(today)
SORT due_date ASC
```

Oder um alle Aufgaben aufzulisten, die sich in Bearbeitung befinden:

```sql
LIST
FROM "projekte/jotter-board/tasks"
WHERE bucket = "in-progress"
```

---

## Aufgaben und Notizen verlinken

Da deine Aufgabenkarten normale Markdown-Notizen sind, kannst du sie über die standardmäßige Markdown-Syntax mit deinem restlichen Wiki verknüpfen.

### Aus Jotter auf Notizen verweisen
In der Aufgabenbeschreibung in Jotter kannst du direkt auf andere Notizen in deinem Obsidian-Vault verlinken:

```markdown
### Spezifikation
Bitte beachte die technischen Details in der [[Spezifikation]] (oder unter [Engineering](../../engineering/spec.md)), bevor du beginnst.
```

In der Jotter-Anwendung führt ein Klick auf diese Links zum Öffnen mit dem Standard-Markdown-Viewer des Systems.

### Aufgaben in täglichen Notizen einbetten
In deinen täglichen Notizen (Daily Notes) in Obsidian kannst du deine erledigten Aufgaben des Tages ganz einfach verlinken:

```markdown
## Heute erledigt
- [[projekte/jotter-board/tasks/01HJKM7ST89AB234CDEFGHJKMN|Sidebar-Doku-Link implementiert]]
- Review des neuen Release-Kandidaten abgeschlossen.
```

---

## Best Practices für die Zusammenarbeit

Jotter ist sehr robust ausgelegt. Dennoch helfen dir diese Tipps, um ein perfektes Zusammenspiel zu garantieren:

* **Frontmatter unberührt lassen**: Wenn du Aufgaben direkt in Obsidian bearbeitest, achte darauf, die wichtigen YAML-Schlüssel wie `id`, `project_id`, `bucket` oder `position` nicht zu löschen, damit Jotter sie weiterhin richtig zuordnen kann.
* **Tags kleinschreiben**: Jotter normalisiert Tags zu Kleinschreibung für einheitliche Filter auf dem Board. Am besten schreibst du deine Tags in beiden Programmen klein.
* **Dateinamenskollisionen vermeiden**: Jotter benennt Dateien nach ID-Slugs, um Kollisionen zu verhindern. Am besten überlässt du Jotter das Erstellen und Löschen von Aufgabendateien, während du Obsidian für die inhaltliche Bearbeitung nutzt.
