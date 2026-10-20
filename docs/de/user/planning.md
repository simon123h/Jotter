# Aufgaben planen

Eine Aufgabe hat zwei Daten, die Verschiedenes bedeuten:

* Das **Fälligkeitsdatum** ist eine Frist: *Bis wann muss es fertig sein?* Es wird rot, wenn es verpasst ist.
* Das **geplante Datum** ist eine Absicht: *Wann habe ich vor, es zu tun?* Verpasst du es, bleibt es leise. Die Aufgabe rutscht einfach weiter und wartet darauf, dass du sie neu planst.

Die meisten Aufgaben brauchen nur ein geplantes Datum.

---

## Wofür du planen kannst

Ein geplantes Datum ist immer ein echter Zeitpunkt, nie "wie die App es gerade versteht":

* ein **Tag**, etwa *21. Oktober 2026*,
* eine **Woche**, etwa *KW 43*: "irgendwann in dieser Woche",
* ein **Monat**, etwa *Oktober 2026*: "irgendwann in diesem Monat".

Das Menü bietet *Heute*, *Morgen*, *Diese Woche*, *Nächste Woche*, *Diesen Monat* und *Nächsten Monat* und einen Tag nach Wahl. *Diese Woche* schreibt die Woche, die heute läuft; nächste Woche ist es eine vergangene Woche.

Ein geplantes Datum, das vorbei ist, ist **verpasst**. Nichts ändert es für dich. Die Planungsansicht zeigt einen Tab *Umplanen*, solange etwas darin liegt, und mit der Auswahlleiste kannst du solche Aufgaben mit einer Aktion neu planen, etwa für heute.

Du kannst eine Aufgabe auf der Aufgabenseite, im Dialog für neue Aufgaben, in der Auswahlleiste (*Planen für...*), durch Ziehen zwischen den Spalten der Planungsansicht oder mit einem Datum im Titel planen (`freitag`, `21.5.`, `morgen`). Ein Datum im Titel plant die Aufgabe. Für eine **Frist** setzt du ein `!` davor (`!freitag`, `!21.5.`) oder das Wort `bis`: `Bericht abgeben bis freitag`.

---

## Vorausplanen und der Horizont

Aufgaben, die weit voraus geplant sind, würden das Board überfüllen. Der **Horizont** bestimmt, wie weit eine Ansicht geplante Aufgaben zeigt. Eine Aufgabe, die dahinter geplant ist, bleibt in ihrer Spalte, ist aber ausgeblendet, bis sie in Reichweite kommt.

| Horizont | Zeigt Aufgaben, die geplant sind bis |
| :--- | :--- |
| **Heute** (Standard) | heute, und alles ohne Datum oder verpasst |
| **Morgen** | morgen |
| **Ende dieser Woche** | den letzten Tag dieser Woche (Montag bis Sonntag) |
| **Ende dieses Monats** | den letzten Tag dieses Monats |
| **Unbegrenzt** | alles |

Eine Woche oder ein Monat beginnt an ihrem ersten Tag: Eine Aufgabe für *nächste Woche* ist bei einem Horizont von heute ausgeblendet und erscheint bei *Ende dieser Woche* erst, wenn sie hineinfällt.

* **Web**: Die Einstellung *Geplante Aufgaben zeigen bis* steht in der Leiste des Boards und im Filterdialog. Sie gilt für Board, Liste, Tags und Matrix. Die Planungsansicht zeigt immer alles. Die Zahl daneben sagt, wie viele Aufgaben aus dem Weg sind.
* **Android**: Das ⋮-Menü hat *Geplante Aufgaben zeigen …*, für Board und Tags zusammen. Er steht im Vault und ist derselbe Wert wie die Einstellung im Web. Die Planungsansicht schaut von Natur aus voraus und hat keinen.

**Suchen und der Horizont.** Eine Abfrage, die geplante Daten nennt (`planned:2026-11`), wird vom Horizont nicht beschnitten: Du hast nach der Planung gefragt, also bekommst du die Antwort. Bei jeder anderen Suche bleiben Aufgaben hinter dem Horizont ausgeblendet, und eine Zeile unter der Leiste sagt *„3 weitere gefunden, geplant hinter dem Horizont“* mit einer Taste, sie zu zeigen. Eine Aufgabe, die du gerade hinter den Horizont geplant hast, wird auf dieselbe Weise gemeldet, damit sie nicht verschwunden wirkt.

---

## Wiederkehrende Aufgaben

Wird eine wiederkehrende Aufgabe erledigt, kommt sie für ihren nächsten Tag geplant zurück und erscheint wieder, wenn der Horizont sie erreicht. Siehe [Wiederkehrende Aufgaben und Erinnerungen](./recurring-and-reminders).

---

## Wie es funktioniert

Das geplante Datum steht im Frontmatter der Aufgabe als `YYYY-MM-DD`, `YYYY-Www` (eine ISO-Woche) oder `YYYY-MM` (ein Monat):

```yaml
---
id: 01HJKM7ST89AB234CDEFGHJKMN
title: Landingpage überarbeiten
status: todo
planned_date: 2026-W43
---
```

Das Planen ändert nie den `status`. Das Ausblenden ist eine Einstellung der Ansicht und steht nicht in der Datei.

### Ältere Dateien

Frühere Versionen schrieben Wörter wie `thisWeek` oder `sometime` in `planned_date` und ein Datum `postponed_until`, das eine Aufgabe bis dahin ausblendete. Sie werden weiter gelesen: Ein Wort wird zu dem Tag, der Woche oder dem Monat, für den es an dem Tag steht, an dem die Datei gelesen wird (`sometime`, `thisYear` und Ähnliches heißen "nicht geplant"), und ein `postponed_until`, das noch bevorsteht, wird zum geplanten Datum. Speichert Jotter die Aufgabe das nächste Mal, schreibt es die neue Form und lässt die alten Schlüssel weg.
