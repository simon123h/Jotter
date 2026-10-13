# Aufgaben aufschieben (Postpone)

Jotter enthält eine leistungsstarke Funktion zum **Aufschieben von Aufgaben (Postpone)**. Diese wurde entwickelt, um der Flut an offenen Aufgaben entgegenzuwirken und den aktiven Arbeitsbereich übersichtlich zu halten.

Wenn Sie eine Aufgabe auf ein zukünftiges Datum aufschieben:
1. Wird sie auf dem Board ausgeblendet. Sie bleibt in ihrer eigenen Spalte (wie *To Do* oder *In Progress*), nichts wird verschoben.
2. **Aufgeschobene Aufgaben ausblenden** ist standardmäßig eingeschaltet. Schalten Sie es aus, um sie in ihrer Spalte zu sehen, mit dem Tag markiert, an dem sie zurückkehren. Die Zahl neben dem Schalter zeigt, wie viele aus dem Weg sind.
3. Sobald das Aufschiebedatum erreicht (oder überschritten) ist, **erscheint** die Aufgabe automatisch wieder.

---

## Eine Aufgabe aufschieben

Es gibt zwei Möglichkeiten, eine Aufgabe aufzuschieben:

### 1. Über das Detail-Overlay der Aufgabe
Klicken Sie doppelt auf eine Aufgabenkarte, um das Detail-Modal zu öffnen.
* Tragen Sie das Datum bei **Zurückgestellt bis** ein, unter der Spaltenauswahl.
* Löschen Sie das Datum, um die Zurückstellung aufzuheben.

### 2. Mehrere Aufgaben auf einmal aufschieben (Bulk Action)
Wählen Sie mehrere Aufgaben aus, indem Sie auf das Kontrollkästchen oben rechts auf den Aufgabenkarten klicken. In der Aktionsleiste (Bulk Action Bar), die am unteren Bildschirmrand erscheint:
* Klicken Sie auf die Schaltfläche **Postpone** (Aufschieben).
* Wählen Sie eine Voreinstellung (z. B. *Morgen*, *Nächste Woche*, *In 2 Wochen*) oder klicken Sie auf **Datum wählen**, um ein benutzerdefiniertes Datum festzulegen.
* Klicken Sie auf **Anwenden**, um alle ausgewählten Aufgaben auf einmal aufzuschieben.

---

## Ein- und Ausblenden der aufgeschobenen Aufgaben

Sie können aufgeschobene Aufgaben jederzeit ein- oder ausblenden:
* **Symbolleiste der Board-Ansicht**: Verwenden Sie das Kontrollkästchen **Postponed ausblenden** neben den Optionen *Done ausblenden* und *Archiv ausblenden*.
* **Filter-Modal**: Öffnen Sie das Filter-Modal (Filtersymbol in der Suchleiste) und aktivieren/deaktivieren Sie die Option **Postponed ausblenden** unter Spaltenfilter.

---

## Funktionsweise im Hintergrund

### Speicherung in reinem Markdown
Jotter ist "local-first" und speichert Ihre Aufgaben in einfachen Markdown-Dateien. Im Gegensatz zum Verschieben in einen physisch anderen Ordner bleibt beim Aufschieben der ursprüngliche Spalte (z. B. `status: todo` oder `status: in-progress`) in der YAML-Frontmatter erhalten und es wird eine `postponed_until`-Eigenschaft hinzugefügt:

```yaml
---
id: 01HJKM7ST89AB234CDEFGHJKMN
title: Landingpage überarbeiten
status: todo
postponed_until: 2026-07-15
---
```

Der `status` wird nie angefasst: Aufschieben verschiebt die Aufgabe nicht, und der Tag der Rückkehr auch nicht. Wer eine aufgeschobene Aufgabe in eine andere Spalte verschiebt, behält die Zurückstellung.

### Abgelaufene Aufschiebungen
Beim Starten von Jotter (oder Laden der Aufgaben) vergleicht das System die Aufschiebedaten mit dem aktuellen Kalenderdatum:
* Liegt `postponed_until` in der **Zukunft**, wird die Aufgabe ausgeblendet (solange *Aufgeschobene Aufgaben ausblenden* an ist) und beim Anzeigen mit ihrem Datum markiert.
* Liegt `postponed_until` in der **Vergangenheit** oder ist **heute**, wird die Aufgabe in ihrer ursprünglichen Spalte (z. B. `todo`) als normale aktive Aufgabe angezeigt. Das abgelaufene Datum verbleibt passiv in der Frontmatter der Markdown-Datei als historischer Bezug, ohne dass automatische Speichervorgänge auf der Festplatte ausgelöst werden. Dies hält Ihre Git-Synchronisationshistorie sauber.
