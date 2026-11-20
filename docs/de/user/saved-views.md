# Gespeicherte Ansichten

Eine **Ansicht** ist eine Suche, die du unter einem Namen behältst. Sie steht in der Seitenleiste über den Projekten und öffnet das Ergebnis mit einem Klick. Ansichten gehören zum Vault, nicht zu einem Projekt, und folgen ihm daher auf jedes Gerät: Die Desktop-App und das Handy lesen dieselbe Liste.

## Eine Suche speichern

1. Gib im Suchfeld eine Suche ein, zum Beispiel `planned:after:today sort:planned` (siehe [Suchen & Filtern](./searching-filtering)).
2. Klicke auf das Lesezeichen im Suchfeld und gib der Ansicht einen Namen.

Eine Suche, die du in einem Projekt speicherst, bekommt `project:<Name>` dazu, die Ansicht zeigt also weiter dieses Projekt. Speichere sie unter _Alle Projekte_ (oder schreibe die Suche ohne `project:`) für eine Ansicht über alle.

Ein Klick auf eine Ansicht in der Seitenleiste öffnet sie. Sie zeigt die passenden Aufgaben aller Projekte in der Reihenfolge, die die Suche verlangt (`sort:`), so ausgelegt, wie `group:` es sagt: `group:planned` als Planungsspalten, `group:tag` als Tags, `group:bucket` als Board. Ohne `group:` ist sie eine einfache **Liste**. Über **...** an der Zeile änderst du Name und Suche oder löschst die Ansicht.

## Die Beispielansichten

Ein Vault beginnt mit zwei Ansichten, die du wie deine eigenen ändern oder löschen kannst:

| Ansicht                 | Suche                                                                                                     |
| :---------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Demnächst**           | `planned:after:today sort:planned group:planned`: alles, was ab heute geplant ist, in den Planungsspalten |
| **Zuletzt hinzugefügt** | `created:after:-7d sort:-created`: was in der letzten Woche dazukam, das Neueste zuerst                   |

Sie werden einmal angeboten. Löschst du sie, bleiben sie gelöscht.

## Auf dem Handy

Die Android-App listet die Ansichten im Seitenmenü und öffnet sie über alle Projekte, wie in [Die Android-App](./mobile#gespeicherte-ansichten) beschrieben. Das Lesezeichen im Suchfeld speichert eine Suche als Ansicht.

## Gut zu wissen

- Eine Suche mit `planned:` (`planned:after:...`) ignoriert den [Planungshorizont](./planning), wie jede Suche mit geplantem Datum. Andere Suchen behalten ihn.
- Erledigte und archivierte Aufgaben bleiben draußen, außer die Suche nennt ihre Spalte (`bucket:done`).
- Ein umbenanntes Tag oder Projekt wird nicht nachgezogen: Die Suche der Ansicht behält den alten Namen.
- Die Ansichten stehen als `views` in der `settings.json` des Vaults: je ein Name und eine Suche.
