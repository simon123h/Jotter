# Die Android-App

Jotter für Android liest und schreibt denselben Vault aus Markdown-Dateien wie die Desktop-App, ganz ohne Server dazwischen. Lege den Vault in einen Ordner, den dein Sync-Werkzeug (Syncthing, Git, ein Cloud-Laufwerk) mit deinem Computer teilt, und beide sehen dieselben Aufgaben. Wie du die App bekommst, steht unter [Installation](/de/installation/precompiled).

Sie deckt den Kern ab: Vaults, Projekte, Spalten, Aufgaben mit allen Eigenschaften, Anhänge, Suche und Filter. Time Blocking, die Canvas und der Git-Verlauf bleiben dem Desktop vorbehalten.

## Vaults und Projekte

Beim ersten Start fragt die App nach einem Ordner als Vault und nach dem Zugriff auf Dateien. Weitere Vaults kannst du hinzufügen und im Seitenmenü wechseln.

- **Projekt wechseln**: Tippe oben auf den Projektnamen und wähle ein Projekt aus der Liste, oder nutze das Seitenmenü.
- **Archivieren**: Unter *Projekte verwalten* legt die Archiv-Taste ein Projekt beiseite (mit Rückgängig). Es verschwindet aus den Listen, und seine Erinnerungen hören auf. Unter *Archiviert* am Ende der Liste holst du es zurück oder löschst es. Die Aufgaben bleiben, wie sie sind.
- **Anheften**: Unter *Projekte verwalten* hält die Pin-Taste ein Projekt in allen Listen oben. Angeheftetes wird pro Vault auf dem Gerät gespeichert.

## Das Board

Jede Spalte ist eine Seite: Wische zur Seite oder tippe auf einen Tab, um die Spalte zu wechseln. Ein Wisch bewegt um eine Spalte.

- **Aufgabe anlegen** mit dem runden Knopf. Das Blatt bleibt offen, du kannst also mehrere hintereinander erfassen.
- **Smarter Titel**: Datumsangaben (`morgen`, `fr`, `21.5.`), Prioritäten (`p1` bis `p4`), Tags (`#haus`) und Spalten (`/doing`) im Titel werden erkannt und als Chips über dem Feld gezeigt. Ein Datum plant die Aufgabe; mit einem `!` davor (`!21.5.`) oder dem Wort `bis` (`bis freitag`) ist es stattdessen eine Frist. Tippe auf das Kreuz eines Chips, um die Wörter als normalen Text zu behalten, oder drücke direkt danach die Rücktaste, um die Erkennung zurückzunehmen.
- **Aufgabe abschließen** mit dem Kreis vor der Aufgabe. Ein Tipp auf den Kreis einer erledigten Aufgabe öffnet sie wieder. Jede Änderung bietet *Rückgängig* an.
- **Aufgabe öffnen** per Tipp. Die Aufgabenseite füllt den Bildschirm: Titel, Notizen, Checkliste, Spalte, Priorität, Datum, Tags, Farbe und Anhänge. Alles wird beim Tippen gespeichert; das Menü oben enthält *Als erledigt markieren*, *Archivieren* und *Löschen*.

## Mehrere Aufgaben auswählen

Halte eine Aufgabe gedrückt, um sie auszuwählen, und tippe dann weitere an. Die Leiste oben zeigt die Anzahl und eine Taste, um die ganze Spalte auszuwählen. Die Werkzeugleiste unten wirkt auf die Auswahl:

| Taste | Bewirkt |
| :-- | :-- |
| Verschieben | Verschiebt die Aufgaben in eine Spalte |
| Tag | Fügt Tags hinzu oder entfernt sie |
| Priorität | Setzt die Priorität |
| Planung | Setzt das geplante Datum |
| Mehr | Erledigen, archivieren, in ein anderes Projekt verschieben, Fälligkeit, Farbe, löschen |

Um Aufgaben ohne das Auswahlfenster zu verschieben, lass sie ausgewählt und öffne eine andere Spalte: Die Leiste oben zeigt dann die Taste *Hierher*, die die ausgewählten Aufgaben ans Ende der Spalte setzt, die du gerade siehst. In der Listenansicht hat jede Abschnittskopfzeile dieselbe Taste, solange Aufgaben ausgewählt sind, auch eine zugeklappte. Die Planung funktioniert genauso: *Hierher* plant die Aufgaben für den Zeitraum, den du gerade siehst (*Nicht geplant* löscht das Datum, *Umplanen* hat keine Taste). In der Tag-Ansicht kann eine Aufgabe in mehreren Spalten stehen, deshalb gibt es kein Verschieben: Die Leiste bietet *#Tag hinzufügen* und *#Tag entfernen* für die Spalte in Sicht, und in *Ohne Tag* die Taste *Tags entfernen*. Um eine einzelne Karte an eine bestimmte Stelle ihrer Spalte zu setzen, halte sie gedrückt und ziehe sie.

## Ansichten

Die Leiste unten wechselt die Ansicht. Die Spalten sind Tabs, zwischen denen du wischen kannst, oder, mit *Als Liste anzeigen* im ⋮-Menü, eine Liste mit einem Abschnitt je Spalte. Ein Abschnitt klappt zu, wenn du auf seine Kopfzeile tippst; leere zeigen nur die Kopfzeile, und *Erledigt* und *Archiv* starten zugeklappt.

- **Board**: ein Tab pro Spalte.
- **Tags**: ein Tab pro Tag und einer für Aufgaben ohne Tag.
- **Planung**: ein Tab für jede Zeitspanne voraus (heute, morgen, Rest dieser Woche, Rest dieses Monats, später), ein Tab *Umplanen*, solange etwas verpasst ist, und einer für Aufgaben ohne Planung.

Eine Aufgabe, die du in einem Tab anlegst, wird dort eingeordnet: mit diesem Tag oder diesem geplanten Datum.

## Suche und Filter

Das Suchfeld versteht dieselbe Abfragesprache wie der Desktop, zum Beispiel `tag:arbeit+dringend prio:high due:none bucket:todo`. Die Filtertaste daneben hat Auswahlfelder für Priorität, Tag und Fälligkeit, die ins Feld schreiben und dem folgen, was du tippst. Die ganze Syntax steht unter [Suche & Filter](/de/user/searching-filtering). Wörter passen auf den Anfang von Wörtern in Titel, Notizen und Tags, `sat` findet also schon beim Tippen *Saturation*.

## Erledigte und archivierte Aufgaben ausblenden, und vorausplanen

Das ⋮-Menü oben blendet erledigte und archivierte Aufgaben ein oder aus, getrennt für jede Ansicht. Auf dem Board verschwinden beim Ausblenden auch deren Spalten. Tags und Planung beginnen mit beiden ausgeblendet.

*Geplante Aufgaben zeigen …* im selben Menü legt fest, wie weit voraus die Ansicht geplante Aufgaben zeigt: heute, morgen, bis Ende der Woche, bis Ende des Monats oder alles. Eine Aufgabe, die dahinter geplant ist, bleibt in ihrer Spalte, ist aber ausgeblendet, bis sie in Reichweite kommt, und das Menü sagt, wie viele aus dem Weg sind. Er gilt für Board und Tags zusammen (*Heute*, bis du ihn änderst) und steht im Vault, ist also derselbe Wert wie die Einstellung am Desktop. Die Planungsansicht schaut von Natur aus voraus und hat keinen Horizont. Siehe [Aufgaben planen](/de/user/planning).

## Einstellungen

Design (auch *True Black* für OLED-Bildschirme, oder dem System folgen, mit einem hellen und einem dunklen Design deiner Wahl), Sprache und die Vaults findest du im Seitenmenü. Ein langer Druck auf das App-Symbol bietet Kürzel für eine neue Aufgabe, die Suche und die Planungsansicht. Die neue Aufgabe aus dem Kürzel kommt, wie geteilter Text, in die Standardspalte des Projekts, das du unter *Einstellungen → Projekt für schnelles Erfassen* gewählt hast, sonst des Projekts, in dem du zuletzt warst. Der Chip über dem Feld zeigt es an, und mit einem Tipp darauf wählst du ein anderes Projekt oder eine andere Spalte. Die Wahl wird im Vault gespeichert, die Desktop-App nutzt sie also auch (siehe [Tastenkürzel](/de/user/shortcuts)).

Um etwas aus einer anderen App zu speichern (eine Webseite, eine Nachricht), nutze deren *Teilen*-Schaltfläche und wähle Jotter. Das Schnellerfassen öffnet sich mit dem geteilten Text: Der Titel, den die andere App mitschickt (meist der Seitentitel), oder die erste Zeile wird zum Titel der Aufgabe, der Rest zu den Notizen. Eine Zeile wie `Schlagzeile – https://…` ergibt die Schlagzeile als Titel und die Adresse als Notizen. Tags, Datumsangaben und Priorität im Text werden wie gewohnt erkannt.

## Synchron bleiben

Die App durchsucht den Vault regelmäßig und wenn du zu ihr zurückkehrst, Änderungen deines Sync-Werkzeugs erscheinen also von selbst. *Offenen Vault neu einlesen* in der Vault-Liste (tippe im Seitenmenü auf den Vault) tut das sofort. Die App behält, was sie nicht versteht: unbekannte Eigenschaften und Dateien werden nie entfernt.
