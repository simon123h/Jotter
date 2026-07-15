# Import & Export von Daten

Jotter enthält leistungsstarke, lokale Tabellen-Dienstprogramme, mit denen Sie Aufgaben nahtlos aus jeder Standard-Excel- oder CSV-Tabelle importieren sowie Ihre aktuell gefilterten Aufgabenansichten exportieren können. Alle Verarbeitungsschritte werden ausschließlich clientseitig innerhalb von Jotter ausgeführt, sodass Ihre Daten privat bleiben.

---

## 📥 Tabellen-Importer (Excel & CSV)

Jotter verfügt über einen flexiblen, schrittweisen Import-Assistenten, mit dem Sie Boards und Aufgaben aus Microsoft Planner, anderen Aufgabenmanagern oder benutzerdefinierten Tabellenkalkulationen migrieren können.

### 🚀 Ausführen des Import-Assistenten

1. Öffnen Sie Jotter und wählen Sie das Projekt aus, in das Sie Ihre Aufgaben importieren möchten.
2. Klicken Sie in der Seitenleiste auf **"Excel/CSV importieren"**.
3. Ziehen Sie Ihre `.xlsx`- oder `.csv`-Datei per Drag & Drop in die Upload-Zone oder klicken Sie auf **"Dateien durchsuchen"**, um sie auszuwählen.

### ⚙️ Schritte und Konfiguration

#### 1. Tabellenblatt-Auswahl (Sheets)
Wenn Sie eine Excel-Arbeitsmappe (`.xlsx`) hochladen, die mehrere Tabellenblätter enthält, können Sie über das Dropdown-Menü auswählen, aus welchem Blatt importiert werden soll.
* *Intelligente Erkennung*: Jotter scannt beim Laden die Namen der Tabellenblätter und wählt automatisch Blätter aus, die gängigen Aufgabenmustern wie `"Tasks"`, `"Aufgaben"`, `"Konsolidierte Daten"` usw. entsprechen.

#### 2. Feld- & Spaltenzuordnung (Mapping)
Jotter ordnet Ihre Tabellenspalten automatisch dem nativen Aufgabenmodell von Jotter zu, indem nach typischen englischen und deutschen Schlüsselwörtern gesucht wird. Sie können diese Zuordnungen überprüfen oder anpassen:
* **Aufgabenname** (erkennt `Title`, `Task title`, `Name`, `Aufgabenname`) &mdash; **Erforderlich**
* **Notizen & Beschreibung** (erkennt `Description`, `Notes`, `Notizen`, `Body`, `Beschreibung`)
* **Spaltenname / Eimer** (erkennt `Bucket`, `Eimer`, `Column`, `Status`)
* **Priorität** (erkennt `Priority`, `Priorität`) &mdash; wird auf Prioritäts-Tags abgebildet (`urgent`, `high`, `medium`, `low`)
* **Bezeichnungen / Tags** (erkennt `Tags`, `Labels`, `Bezeichnungen`) &mdash; trennt an Kommas oder Semikolons auf
* **Fälligkeitsdatum** (erkennt `Due date`, `Due`, `Fälligkeitsdatum`)
* **Startdatum** (erkennt `Start date`, `Start`, `Startdatum`) &mdash; entspricht Jotters Startdatum
* **Checkliste** (erkennt `Checklist`, `Checklistenpunkte`) &mdash; parst Checklisteneinträge in das GFM-Checkbox-Format im Beschreibungstext

#### 3. Ziel-Spalten-Strategie
Wählen Sie aus, wie Aufgaben auf Ihrem Board verteilt werden sollen:
* **Spaltenname aus Eimer-Spalte übernehmen**: Erstellt Spalten in Jotter, die nach der Eimer-Spalte Ihrer Tabelle benannt sind. Fehlende Spalten werden automatisch erzeugt.
* **Nach Fortschritts-Status verteilen**: Platziert Aufgaben basierend auf ihrem Status in den Standardspalten (`To Do`, `In Bearbeitung`, `Done`).
* **Alle in einer Spalte platzieren**: Legt alle importierten Aufgaben in einer einzigen Spalte Ihrer Wahl ab.

#### 4. Vorschau und Bestätigen
Vor dem Schreiben auf die Festplatte zeigt Jotter eine detaillierte, interaktive Zeilen-Vorschau an:
* Aufgaben mit Validierungsfehlern (z. B. fehlender Titel) werden markiert und beim Import übersprungen.
* Abgeschlossene Aufgaben zeigen automatisch ihre Zielspalte überschrieben auf Jotters native Spalte **Done** (z. B. ~~Marketing~~ &rarr; `Done (Override)`).
* Klicken Sie auf **Aufgaben importieren**, um die Aufgaben als standardmäßige Markdown-Dateien zu erstellen und zu speichern.

---

## 📤 Tabellen-Exporter (Excel & CSV)

Jotter ermöglicht es Ihnen, Ihre Aufgaben direkt aus der aktuellen Ansicht als `.xlsx`-Excel-Tabelle oder `.csv`-Textdatei zu exportieren.

### 🚀 Ausführen des Exports

1. Navigieren Sie zu der gewünschten Ansicht (Board, Liste, Matrix, Tags, Zeit oder Triage) und wenden Sie beliebige Projektfilter, Suchanfragen oder erweiterte Filter an.
2. Klicken Sie in der oberen Symbolleiste auf die Schaltfläche **Weitere Optionen** (drei vertikale Punkte `...`) neben der Ansichtsauswahl.
3. Wählen Sie entweder **Als Excel exportieren (.xlsx)** oder **Als CSV exportieren (.csv)**.
4. Jotter generiert die Tabelle clientseitig und startet den lokalen Dateidownload.

### 📊 Exportierte Spalten
Die exportierte Tabelle enthält alle relevanten Aufgaben-Metadaten strukturiert in folgenden Spalten:
* **ID**: Jotters interner Dateiname/Bezeichner der Aufgabe.
* **Titel**: Der Titel der Aufgabe.
* **Beschreibung**: Der vollständige Beschreibungstext der Aufgabe (inklusive Markdown-Formatierung).
* **Spalte**: Die aktive Kanban-Spalte, in der sich die Aufgabe befindet.
* **Priorität**: Die Prioritätsstufe (`urgent`, `high`, `medium`, `low` oder `normal`).
* **Tags**: Eine durch Semikolon getrennte Liste von Tags.
* **Startdatum / Fälligkeitsdatum**: Datumswerte sauber formatiert als `YYYY-MM-DD`.
* **Projekt**: Der Name des übergeordneten Projekts.

---

## 🔒 Sicherheit & Lokale Verarbeitung
Sämtliche Lese-, Mapping- und Exportprozesse laufen **100% lokal** in Ihrer Browser-/Anwendungsumgebung ab. Es werden keinerlei Daten an externe Server gesendet.
