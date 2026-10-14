# Links und Lesezeichen

Eine Aufgabe, deren Titel oder Notizen eine Webadresse enthalten, ist ein Lesezeichen. Dafür wird nichts Besonderes gespeichert:
Die Adresse ist einfacher Text, die Datei bleibt also überall lesbar. Nimm ein Projekt wie *Links*, Spalten wie *Eingang*,
*Zu lesen* und *Erledigt* und Tags für Themen, dann funktionieren Suche, Erinnerungen und der Git-Verlauf für deine Lesezeichen
wie für jede Aufgabe.

## Der Link auf der Karte

Die erste Webadresse im Titel, sonst in den Notizen, erscheint auf der Karte als Domain (`example.com`). Ein Tipp darauf öffnet die
Seite im Browser, ohne die Aufgabe zu öffnen.

## Schon gespeichert

Ist die Adresse, die du anlegst, im Projekt schon vorhanden, sagt der Dialog *Schon gespeichert: …* und nennt die Aufgabe. Er hält
dich nicht auf: Adressen gelten als dieselbe Seite ohne `www.`, `#Fragment`, abschließendes `/` und Tracking-Parameter wie
`utm_source`. Der Desktop prüft die Aufgaben, die auf dem Board geladen sind.

## Titel von Links (optional)

Wenn du eine Aufgabe anlegst, die **nur** aus einer Webadresse besteht (eingefügt oder aus einer anderen App geteilt), kann Jotter
den Titel der Seite lesen und als Titel der Aufgabe verwenden; die Adresse wandert in die Notizen. Das ist **standardmäßig aus**,
weil dabei die Website kontaktiert wird: Die Adresse wird an sie gesendet, sonst nichts.

- **Desktop**: *Einstellungen → Titel von Links nachschlagen*. Der Jotter-Server lädt die Seite und braucht dafür Internet. Er holt nur
  `http`- und `https`-Adressen, nie einen Host auf deinem Rechner oder in deinem Netz, gibt nach sechs Sekunden auf und liest höchstens
  ein halbes Megabyte.
- **Android**: *Einstellungen → Titel von Links nachschlagen*. Das Telefon lädt die Seite.

Kann die Seite nicht rechtzeitig gelesen werden oder hat sie keinen Titel, ändert sich nichts: Die Aufgabe behält die Adresse als Titel.
Einen Titel, den du selbst tippst, während die Suche läuft, ersetzt Jotter nie.
