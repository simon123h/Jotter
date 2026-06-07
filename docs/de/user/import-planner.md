# Import aus Microsoft Planner

Jotter enthält einen leistungsstarken, lokalen **Microsoft Planner Importer**, mit dem Sie Ihre vorhandenen Boards und Aufgaben ganz einfach aus Microsoft Planner nach Jotter migrieren können. Ihre importierten Aufgaben werden direkt clientseitig geparst und als Standard-Markdown-Dateien abgesichert.

---

## 📥 So exportieren Sie Ihren Plan aus MS Planner

Bevor Sie importieren können, müssen Sie Ihren Plan aus der offiziellen Microsoft Planner-Oberfläche exportieren:

1. Öffnen Sie **Microsoft Planner** in Ihrem Webbrowser.
2. Wählen Sie den Plan aus, den Sie exportieren möchten.
3. Klicken Sie in der Kopfzeile auf das Symbol **"..." (Mehr)** neben "Zeitplan".
4. Wählen Sie **"Plan nach Excel exportieren"**.
5. Ihr Browser lädt eine Standard-`.xlsx`-Datei herunter.

---

## 🚀 Ausführen des Import-Assistenten in Jotter

So starten Sie den Import:

1. Öffnen Sie Jotter.
2. Öffnen Sie das Projekt, in das Sie Ihre Aufgaben importieren möchten.
3. Klicken Sie in der Seitenleiste auf **"Import MS Planner"** (nur sichtbar bei geöffnetem Projekt).
4. Ziehen Sie Ihre `.xlsx`-Datei per Drag & Drop in die Upload-Zone oder klicken Sie auf **"Browse Files"**, um sie auszuwählen.

---

## ⚙️ Konfiguration & Spaltenzuordnung (Mappings)

Der Assistent führt Sie Schritt für Schritt durch die Zuordnung Ihrer Excel-Daten zum Aufgabenmodell von Jotter:

### 1. Tabellenblatt-Auswahl (Sheets)
Microsoft Planner-Exporte können mehrere Tabellenblätter enthalten (z. B. lokalisierte Datenblätter).
* **Intelligente Erkennung**: Jotter scannt automatisch alle Tabellenblätter und wählt das richtige Blatt aus, wenn es gängigen Begriffen wie `"Konsolidierte Daten"`, `"Consolidated Data"`, `"Tasks"` oder `"Aufgaben"` entspricht.
* **Manuelle Auswahl**: Wenn Ihr Datenblatt einen anderen Namen hat, können Sie es oben im Mapping-Bildschirm über das Dropdown-Menü auswählen. Ein Wechsel lädt und analysiert die Spaltenköpfe und Aufgabenzeilen sofort neu.

### 2. Spaltenzuordnungen
Jotter ordnet Ihre Spalten automatisch zu, indem es nach typischen englischen und deutschen Schlüsselwörtern sucht:
* **Aufgabenname** (erkennt `Aufgabenname`, `Task title`, `Title`, `Name`) &mdash; **Erforderlich**
* **Notizen** (erkennt `Notizen`, `Description`, `Notes`, `Body`, `Beschreibung`)
* **Eimer** (erkennt `Eimer`, `Bucket name`, `Bucket`) &mdash; entspricht den Kanban-Spalten
* **Status** (erkennt `Status`, `Progress`, `State`)
* **Priorität** (erkennt `Priorität`, `Priorität`, `Priority`)
* **Bezeichnungen** (erkennt `Bezeichnungen`, `Labels`, `Tags`) &mdash; entspricht Jotter Tags
* **Fälligkeitsdatum** (erkennt `Fälligkeitsdatum`, `Due date`, `Due`, `Deadline`)
* **Startdatum** (erkennt `Startdatum`, `Start date`, `Start`) &mdash; entspricht Jotters Startdatum
* **Checklistenpunkte** (erkennt `Checklistenpunkte`, `Checklist`)

### 3. Ziel-Spalten-Strategie
Sie können entscheiden, wie die Aufgaben auf Ihrem Jotter-Board verteilt werden sollen:

* **Spaltenname aus Eimer-Spalte übernehmen**: Erstellt Spalten in Jotter, die nach Ihren Planner-Eimern benannt sind. Fehlende Spalten werden automatisch erzeugt.
* **Nach Fortschritts-Status verteilen**: Platziert Aufgaben basierend auf ihrem Fortschrittszustand in den Standardspalten (`To Do`, `In Bearbeitung`, `Done`).
* **Alle in einer Spalte platzieren**: Ignoriert Eimer-Namen und legt alle importierten Aufgaben in einer einzigen von Ihnen ausgewählten Spalte ab.

> [!NOTE]
> **Fallback-Spalte**: Wenn eine Aufgabe keinen Eimer-Namen hat, wird sie in der ausgewählten Fallback-Spalte abgelegt.

---

## ⚡ Abgeschlossene Aufgaben überschreiben (Status Overrides)

In Microsoft Planner bleiben abgeschlossene Aufgaben in ihren ursprünglichen Eimern, werden jedoch visuell abgehakt. In Jotter hingegen werden abgeschlossene Aufgaben in die einheitliche Spalte **"Erledigt"** (Done) verschoben.

Um maximale Kompatibilität zu gewährleisten, implementiert Jotter **Status Overrides**:
* **Ablauf**: Wenn Sie die Strategie *Eimer-Spalte übernehmen* wählen, registriert und erstellt Jotter **zuerst** den ursprünglichen Eimer (z. B. "Marketing") auf Ihrem Board, damit Ihre Spaltenstruktur erhalten bleibt.
* **Status-Ablenkung**: Danach wird die Spalte **Status** geprüft. Wenn diese signalisiert, dass die Aufgabe abgeschlossen ist (z. B. `"Abgeschlossen"`, `"Completed"`, `"Done"` oder `"Erledigt"`), überschreibt Jotter die Eimer-Einstellung und verschiebt die Aufgabe direkt in Jotters native Spalte **"Done"**.
* **Vorschau und Protokolle**: In Schritt 3 (Vorschau) werden diese Aufgaben visuell markiert, indem der Original-Eimer durchgestrichen dargestellt wird (z. B. ~~Marketing~~ &rarr; `Done (Override)`). Auch im Echtzeit-Importprotokoll wird diese Umleitung genau dokumentiert.

---

## 📝 Markdown-Konvertierung

Während des Imports werden Ihre Excel-Zellen clientseitig in Git-freundliches Markdown konvertiert:

* **Prioritäten**: Planner-Prioritäten (*Dringend, Wichtig, Normal, Niedrig*) werden in Jotters internes Tag-Format übersetzt.
* **Daten**: Datumsangaben im Excel-Format werden in das standardmäßige ISO-Format (`YYYY-MM-DD`) konvertiert.
* **Bezeichnungen (Tags)**: Labels werden an Semikolons oder Kommas getrennt und als native Jotter-Tags gespeichert.
* **Checklisten**: Wenn Checklistenpunkte existieren, werden diese als interaktive GFM-Checkboxen an die Aufgabenbeschreibung angehängt:
  ```markdown
  ### Checklist
  - [ ] Farbpaletten recherchieren
  - [ ] CSS-Variablen deklarieren
  ```

---

## 🔒 Sicherheit & Lokale Verarbeitung

Sämtliche Parsing- und Import-Aktivitäten finden **ausschließlich clientseitig** in Ihrer lokalen Jotter-Anwendung statt. Ihre Excel-Dateien werden niemals auf einen Cloud-Server hochgeladen, um Jotters lokalen Datenschutzanspruch vollständig zu wahren.
