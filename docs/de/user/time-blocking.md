# Time Blocking (Tagesplaner-Seitenleiste)

Die **Time Blocking**-Seitenleiste bietet einen interaktiven Tagesplaner, mit dem du Fokuszeiten planen und Aufgaben gezielt auf Zeitfenster verteilen kannst – direkt neben deinem Kanban-Board oder deinen Listenansichten, ganz ohne Kontextwechsel.

---

## Konzept & Funktionsweise

Time Blocking trennt **Zeitblöcke** sauber von **Aufgaben**:
* Ein **Zeitblock** ist ein bewusster Fokusblock (z. B. *09:00–11:30 Deep Work: Auth-API*, *14:00–15:00 Code-Reviews*).
* **Aufgaben** werden per Klick oder Drag & Drop direkt aus dem Board oder der Listenansicht in diese Blöcke einsortiert.
* Bündle mehrere Aufgaben (oder Mehrfachauswahlen) in einem Zeitblock, hake Aufgaben direkt im Block ab oder passe die Dauer flexibel per Ziehen an.

```mermaid
flowchart LR
    A["Kanban-Board / Liste"] -->|Aufgabe(n) zuweisen| B["Time Blocking Seitenleiste"]
    B --> C["Tagesplan (06:00–18:00)"]
    C --> D["Aufgaben direkt abhaken & anpassen"]
```

---

## Funktionen im Überblick

### 1. Interaktive Tagesplaner-Seitenleiste
* **Überall einblendbar**: Klicke oben in der Navigationsleiste auf **Time Blocking**, um die Seitenleiste ein- oder auszublenden.
* **1-Klick-Tagesnavigation**: Wechsle bequem mit `<` und `>` zwischen Tagen, nutze die Datumsauswahl oder springe direkt zu **Heute**.
* **Echtzeit-Zeitanzeige**: Eine rote Markierung mit Live-Uhrzeit zeigt stets den aktuellen Zeitpunkt an und scrollt beim Öffnen automatisch dorthin.

### 2. Zeitblöcke erstellen & bearbeiten
* **Klick in Kalenderslot**: Klicke auf ein freies Stundenfeld, um sofort einen Zeitblock für diese Zeit anzulegen.
* **Klick zum Bearbeiten**: Klicke auf eine Box, um den Bearbeitungsdialog für Titel, Zeiten, Wiederholung, Farbton oder Löschen zu öffnen.
* **Wiederholungen**: Lege wiederkehrende Fokusblöcke fest (**Täglich**, **Werktags (Mo–Fr)**, **Wöchentlich** oder **Zweiwöchentlich**).
* **Farbakzente**: Wähle aus abgestimmten Farbtönen (Rot, Orange, Gelb, Grün, Blau, Violett, Pink), passend zu den Aufgabenkarten.

### 3. Aufgaben zuordnen (Einzeln & Mehrfach)
* Wähle Aufgaben auf dem Board aus und klicke auf das **Aufgaben hinzufügen**-Symbol (`+` / ListPlus) in der Kopfzeile des Zeitblocks.
* Aufgaben mit Zeitblock-Zuordnung zeigen ein dezentes Zeitblock-Badge auf ihrer Aufgabenkarte in allen Board- und Listenansichten an.
* Wird eine Aufgabe direkt im Zeitblock als erledigt abgehakt (`☑`), wird sie als erledigt markiert und automatisch aus dem Block entfernt.
* Aufgaben können jederzeit auch manuell über das <kbd>×</kbd>-Symbol aus dem Block entfernt werden.

### 4. Verschieben & Dauer anpassen
* **Startzeit verschieben**: Ziehe einen Zeitblock nach oben oder unten, um ihn im 15-Minuten-Raster zu verschieben.
* **Dauer anpassen**: Ziehe am unteren Rand eines Zeitblocks, um seine Dauer beliebig zu verlängern oder zu verkürzen.

---

## Einstellungen

Unter **Einstellungen → Time Blocking** kannst du festlegen:
* **Tagesplan-Startuhrzeit**: Früheste sichtbare Stunde im Raster (z. B. `6` oder `8`).
* **Tagesplan-Enduhrzeit**: Späteste sichtbare Stunde im Raster (z. B. `18` oder `20`).
