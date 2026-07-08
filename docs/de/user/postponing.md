# Aufgaben aufschieben (Postpone)

Jotter enthält eine leistungsstarke Funktion zum **Aufschieben von Aufgaben (Postpone)**. Diese wurde entwickelt, um der Flut an offenen Aufgaben entgegenzuwirken und den aktiven Arbeitsbereich übersichtlich zu halten.

Wenn Sie eine Aufgabe auf ein zukünftiges Datum aufschieben:
1. Verschwindet sie aus Ihren aktiven Board-Spalten (wie *To Do* oder *In Progress*).
2. Wird sie in eine virtuelle **Postponed** (Aufgeschoben) Spalte platziert.
3. Die virtuelle Spalte kann jederzeit ein- oder ausgeblendet werden. Wenn sie ausgeblendet ist, werden aufgeschobene Aufgaben vollständig aus Ihrer Ansicht gefiltert.
4. Sobald das Aufschiebedatum erreicht (oder überschritten) ist, **erscheint** die Aufgabe automatisch wieder in ihrer ursprünglichen Spalte.

---

## Eine Aufgabe aufschieben

Es gibt drei Möglichkeiten, eine Aufgabe aufzuschieben:

### 1. Über das Detail-Overlay der Aufgabe
Klicken Sie doppelt auf eine Aufgabenkarte, um das Detail-Modal zu öffnen.
* Ändern Sie das Spalten-Dropdown-Menü auf **Postponed** (Aufgeschoben).
* Unter der Spaltenauswahl erscheint ein Datumsfeld.
* Wählen Sie das Datum aus, bis zu dem die Aufgabe ausgeblendet bleiben soll. Wenn kein Datum ausgewählt wird, wird standardmäßig der **nächste Tag (morgen)** verwendet.

### 2. Per Drag & Drop
Blenden Sie die Spalte *Postponed* (Aufgeschoben) auf dem Kanban-Board ein (siehe unten). Ziehen Sie eine Aufgabenkarte aus einer anderen Spalte direkt in die Spalte **Postponed**. Dadurch wird das Aufschiebedatum automatisch auf **morgen** gesetzt.

### 3. Mehrere Aufgaben auf einmal aufschieben (Bulk Action)
Wählen Sie mehrere Aufgaben aus, indem Sie auf das Kontrollkästchen oben rechts auf den Aufgabenkarten klicken. In der Aktionsleiste (Bulk Action Bar), die am unteren Bildschirmrand erscheint:
* Klicken Sie auf die Schaltfläche **Postpone** (Aufschieben).
* Wählen Sie eine Voreinstellung (z. B. *Morgen*, *Nächste Woche*, *In 2 Wochen*) oder klicken Sie auf **Datum wählen**, um ein benutzerdefiniertes Datum festzulegen.
* Klicken Sie auf **Anwenden**, um alle ausgewählten Aufgaben auf einmal aufzuschieben.

---

## Ein- und Ausblenden der aufgeschobenen Aufgaben

Sie können die Spalte "Postponed" jederzeit ein- oder ausblenden:
* **Symbolleiste der Board-Ansicht**: Verwenden Sie das Kontrollkästchen **Postponed ausblenden** neben den Optionen *Done ausblenden* und *Archiv ausblenden*.
* **Filter-Modal**: Öffnen Sie das Filter-Modal (Filtersymbol in der Suchleiste) und aktivieren/deaktivieren Sie die Option **Postponed ausblenden** unter Spaltenfilter.

---

## Funktionsweise im Hintergrund

### Speicherung in reinem Markdown
Jotter ist "local-first" und speichert Ihre Aufgaben in einfachen Markdown-Dateien. Im Gegensatz zum Verschieben in einen physisch anderen Ordner bleibt beim Aufschieben der ursprüngliche `bucket`-Parameter (z. B. `bucket: todo` oder `bucket: in-progress`) in der YAML-Frontmatter erhalten und es wird eine `postponed_until`-Eigenschaft hinzugefügt:

```yaml
---
id: 01HJKM7ST89AB234CDEFGHJKMN
title: Landingpage überarbeiten
bucket: todo
postponed_until: 2026-07-15
---
```

Da die ursprüngliche Spalte (`bucket`) gespeichert bleibt, weiß Jotter nach Ablauf der Frist genau, in welche Spalte die Aufgabe zurückkehren soll.

### Abgelaufene Aufschiebungen
Beim Starten von Jotter (oder Laden der Aufgaben) vergleicht das System die Aufschiebedaten mit dem aktuellen Kalenderdatum:
* Liegt `postponed_until` in der **Zukunft**, wird die Aufgabe virtuell der Spalte "Postponed" zugeordnet.
* Liegt `postponed_until` in der **Vergangenheit** oder ist **heute**, wird die Aufgabe in ihrer ursprünglichen Spalte (z. B. `todo`) als normale aktive Aufgabe angezeigt. Das abgelaufene Datum verbleibt passiv in der Frontmatter der Markdown-Datei als historischer Bezug, ohne dass automatische Speichervorgänge auf der Festplatte ausgelöst werden. Dies hält Ihre Git-Synchronisationshistorie sauber.
