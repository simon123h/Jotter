# Time Boxing (Tagesplaner-Seitenleiste)

Die **Time Boxing**-Seitenleiste bietet einen interaktiven Tagesplaner, mit dem du Fokuszeiten planen und Aufgaben gezielt auf Zeitfenster verteilen kannst – direkt neben deinem Kanban-Board oder deinen Listenansichten, ganz ohne Kontextwechsel.

---

## Konzept & Funktionsweise

Time Boxing trennt **Zeitfenster (Boxen)** sauber von **Aufgaben**:
* Eine **Timebox** ist ein bewusster Fokusblock (z. B. *09:00–11:30 Deep Work: Auth-API*, *14:00–15:00 Code-Reviews*).
* **Aufgaben** werden per Drag & Drop direkt aus dem Board oder der Listenansicht in diese Boxen einsortiert.
* Bündle mehrere Aufgaben (oder Mehrfachauswahlen) in einer Timebox, hake Aufgaben direkt in der Box ab oder passe die Dauer flexibel per Ziehen an.

```mermaid
flowchart LR
    A["Kanban-Board / Liste"] -->|Aufgabe(n) ziehen| B["Time Boxing Seitenleiste"]
    B --> C["Tagesplan (08:00–18:00)"]
    C --> D["Aufgaben direkt abhaken & anpassen"]
```

---

## Funktionen im Überblick

### 1. Interaktive Tagesplaner-Seitenleiste
* **Überall einblendbar**: Klicke oben in der Navigationsleiste auf **Time Boxing**, um die Seitenleiste ein- oder auszublenden.
* **1-Klick-Tagesnavigation**: Wechsle bequem mit `<` und `>` zwischen Tagen, nutze die Datumsauswahl oder springe direkt zu **Heute**.
* **Echtzeit-Zeitanzeige**: Eine rote Markierung mit Live-Uhrzeit zeigt stets den aktuellen Zeitpunkt an und scrollt beim Öffnen automatisch dorthin.

### 2. Timeboxen erstellen & bearbeiten
* **Klick in Kalenderslot**: Klicke auf ein freies Stundenfeld, um sofort eine Timebox für diese Zeit anzulegen.
* **Header-Button**: Klicke oben in der Seitenleiste auf **+ Neue Timebox**.
* **Zufällige Farbakzente**: Jeder neuen Timebox wird automatisch eine ansprechende Farbe zugewiesen (Blau, Smaragd, Bernstein, Rose, Petrol, Indigo, Violett, Schiefer).

### 3. Aufgaben per Drag & Drop zuordnen (Einzeln & Mehrfach)
* Ziehe Aufgabenkarten direkt von deinem Kanban-Board oder aus Listen in eine Timebox.
* **Mehrfachauswahl-Unterstützung**: Wähle mehrere Aufgaben auf dem Board aus und ziehe sie alle gemeinsam mit einem Drop in die Box!
* Aufgaben können mit interaktiven Checkboxen (`☑ / ☐`) direkt in der Timebox erledigt oder über das <kbd>×</kbd>-Symbol entfernt werden.

### 4. Verschieben & Dauer anpassen
* **Startzeit verschieben**: Ziehe eine Timebox nach oben oder unten, um sie im 15-Minuten-Raster zu verschieben.
* **Dauer anpassen**: Ziehe am unteren Rand einer Timebox, um ihre Dauer beliebig zu verlängern oder zu verkürzen.

---

## Einstellungen

Unter **Einstellungen → Time Boxing** kannst du festlegen:
* **Kalender-Startuhrzeit**: Früheste sichtbare Stunde im Raster (z. B. `8`).
* **Kalender-Enduhrzeit**: Späteste sichtbare Stunde im Raster (z. B. `18`).
