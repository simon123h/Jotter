# Aufgaben hinein- und herausholen

Jotter hat keinen Import- oder Export-Assistenten. Dein Vault ist ein Ordner voller Markdown-Dateien, also gibt es beim Herausholen nichts umzuwandeln, und für das Hineinholen gibt es zwei Wege.

## Aufgaben herausholen

Kopiere den Vault-Ordner oder öffne ihn in einem beliebigen Editor oder in Obsidian. Jede Aufgabe ist eine `.md`-Datei mit einem kleinen Kopfbereich (siehe das [Dateiformat](./format-spec.md)). Brauchst du eine Tabelle, genügen in jeder Sprache wenige Zeilen Skript, die den Kopf der Dateien lesen. Ist dein Vault ein Git-Repository, ist dessen Verlauf die Sicherung.

## Aufgaben aus einem anderen Werkzeug hineinholen

### Mit einem KI-Assistenten (MCP)

Verbinde einen Assistenten über den [MCP-Server](../../developer/api.md#model-context-protocol-mcp-integration) (`jotter mcp`), gib ihm den Export des anderen Werkzeugs (eine Excel- oder CSV-Datei aus Microsoft Planner, einen JSON-Export aus Trello, eine Textliste, einen Screenshot) und bitte ihn, die Aufgaben zu übertragen:

> Lies `planner-export.xlsx` und lege die Aufgaben im Projekt „Renovierung“ an. Nimm eine Spalte pro Planner-Bucket, setze Priorität und Fälligkeitsdatum, schreibe die Checklistenpunkte in die Notizen und markiere erledigte Aufgaben als erledigt.

Der Assistent benutzt `create_project`, `create_bucket` und `batch_create_tasks` (Titel, Spalte, Tags, Notizen, Priorität, Fälligkeits- und Plandatum). Das funktioniert mit jedem Quellformat, und unterwegs lässt sich aufräumen: Duplikate zusammenführen, Spaltennamen übersetzen oder alte erledigte Aufgaben weglassen. Sieh dir das Ergebnis auf dem Board an und committe es dann (Jotter committet selbst, wenn der Vault ein Git-Repository ist).

### Mit einem Skript

Ein Skript kann die Aufgabendateien direkt schreiben, nach dem [Dateiformat](./format-spec.md): eine `.md`-Datei pro Aufgabe im Projektordner, mit `status` (die Spalte), `title` und den optionalen Feldern im Kopf. Jotter bemerkt die neuen Dateien beim nächsten Scan.
