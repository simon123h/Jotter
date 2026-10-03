# 2D Infinite Canvas

Jotter verfügt über ein vollwertiges, unendliches 2D-Canvas (Visual Board), mit dem Sie Aufgaben, Notizen und Konzepte räumlich frei organisieren, gruppieren und verknüpfen können – parallel zu Ihrem klassischen Kanban-Board.

Canvases werden im Ordner `canvases/` Ihres Projekts als Standard-JSON-Dateien nach der **Obsidian Canvas 1.0 JSON-Spezifikation** (`<name>.canvas`) gespeichert. Dadurch entsteht kein Vendor-Lock-in und Sie können die Boards nahtlos mit PKM-Tools teilen.

---

## Zugriff auf das Canvas

1. Navigieren Sie zu einem beliebigen Projekt in Jotter.
2. Wählen Sie im oberen Ansichtswechsler den Reiter **Canvas**.
3. Das Board wird automatisch geladen. Existiert für das Projekt noch kein Canvas, initialisiert Jotter automatisch `main.canvas`.

---

## Navigation & Modi

Das unendliche Board bietet zwei Interaktionsmodi:
* **Verschiebe-Modus / Pan (`Hand`-Symbol)**: Klicken und ziehen Sie auf freier Fläche, um die Ansicht zu verschieben.
* **Auswahl-Modus / Marquee (`Mauszeiger`-Symbol)**: Ziehen Sie einen Rahmen über die Fläche, um mehrere Knoten gleichzeitig auszuwählen.

> [!TIP] Tastenkombinationen
> * Drücken Sie <kbd>V</kbd>, um schnell zwischen **Pan-Modus** und **Auswahl-Modus** zu wechseln.
> * Im Auswahl-Modus können Sie die <kbd>Leertaste</kbd> gedrückt halten, während Sie mit der Maus ziehen, um die Ansicht temporär zu verschieben.
> * Nutzen Sie das Mausrad oder Trackpad-Gesten, um stufenlos hinein- und herauszuzoomen.
> * Beim Öffnen oder Wechseln eines Canvas zoomt Jotter automatisch so, dass alle vorhandenen Inhalte optimal ins Blickfeld passen.

---

## Canvas-Elemente

Das Canvas unterstützt drei Knotentypen sowie verbindende Pfeile:

### 1. Aufgabenkarten (Tasks)
* Öffnen Sie die **Tasks Drawer** (Aufgabenleiste) auf der rechten Seite der Toolbar.
* Ziehen Sie eine noch nicht platzierte Aufgabe per Drag & Drop auf die Canvas-Fläche.
* Die Karte zeigt den aktuellen Status, Priorität, Tags, Checklisten-Fortschritt und Farbmarkierung.
* Aufgaben können auf der Leinwand frei platziert, mit Notizen verknüpft oder für Massenaktionen ausgewählt werden.

### 2. Markdown-Notizen (`Add Text`)
* Klicken Sie in der Toolbar auf **Add Text**. Eine neue Textkarte wird direkt im Zentrum des aktuellen Bildschirmausschnitts platziert.
* Ein Doppelklick auf die Notiz öffnet den Markdown-Editor. Klicken Sie daneben oder auf das Häkchen, um zu speichern.
* Über das Farbpaletten-Symbol können Sie der Notiz eine farbliche Akzentuierung zuweisen.
* Über die Ränder lässt sich die Notizkarte in der Größe anpassen.

### 3. Gruppen & Bereiche (`Add Group`)
* Klicken Sie auf **Add Group**. Ein neuer Bereich wird im Zentrum des aktuellen Bildschirmausschnitts erzeugt.
* Mit einem Doppelklick auf die Beschriftung können Sie die Gruppe umbenennen.
* Über das Farbsymbol lässt sich Rahmen- und Hintergrundfarbe der Gruppe anpassen.
* Ziehen Sie an den Außenkanten, um die Gruppe beliebig über zusammengehörige Aufgaben und Notizen aufzuspannen. Gruppen liegen visuell im Hintergrund.

### 4. Verbindungspfeile & Relationen
* Bewegen Sie die Maus über einen Knoten, um die 4 Verbindungspunkte (oben, rechts, unten, links) sichtbar zu machen.
* Ziehen Sie von einem Punkt zu einem anderen Knoten, um einen Pfeil zu erstellen.
* Klicken Sie auf einen Pfeil, um die Steuerungsleiste zu öffnen:
  * Farbe des Pfeils anpassen.
  * Pfeilspitzen-Stil wählen (einfach, beidseitig oder ohne Spitze).
  * Pfeilrichtung mit einem Klick umkehren.
  * Beschriftung / Label hinterlegen (z. B. „blockiert“, „benötigt“, „gehört zu“).

---

## Elemente löschen

* Um einen Pfeil zu entfernen, wählen Sie ihn aus und drücken Sie <kbd>Entf</kbd> oder <kbd>Rücktaste</kbd>.
* Um Notizen, Gruppen oder Aufgaben vom Canvas zu entfernen, markieren Sie diese und drücken Sie <kbd>Entf</kbd> oder <kbd>Rücktaste</kbd>.
* *Hinweis: Das Entfernen einer Aufgabe vom Canvas löscht nicht die Aufgabendatei aus dem Projekt.* Die Aufgabe bleibt im Kanban-Board erhalten und kann jederzeit erneut über die Tasks Drawer auf das Board gezogen werden.

---

## Obsidian Canvas Kompatibilität

Jotter speichert Canvases direkt im `canvases/`-Ordner als offene `.canvas`-JSON-Dateien:

```json
{
  "nodes": [
    {
      "id": "c1f7a8b9",
      "type": "file",
      "file": "01HJKM7ST89AB234CDEFGHJKMN.md",
      "x": 200,
      "y": 100,
      "width": 280,
      "height": 140
    }
  ],
  "edges": []
}
```

Befindet sich Ihr Jotter-Projektordner innerhalb eines **Obsidian Vaults**, können Sie diese Datei direkt in Obsidian als Canvas öffnen und synchron weiterbearbeiten!
