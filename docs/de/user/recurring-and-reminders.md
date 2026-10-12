# Wiederkehrende Aufgaben und Erinnerungen

Eine Aufgabe kann nach dem Erledigen **wiederkommen**, und sie kann dich zu einer gewählten Zeit **erinnern**. Beides funktioniert in der Desktop-App und in der Android-App und steht in der Markdown-Datei der Aufgabe, sodass ein zwischen Geräten synchronisierter Vault es mitnimmt.

## Wiederkehrende Aufgaben

Öffne eine Aufgabe und wähle **Wiederholen**: *Täglich*, *Wöchentlich*, *Monatlich*, *Jährlich* oder *Benutzerdefiniert* (alle 3 Tage, alle 2 Wochen usw.). **Kommt wieder** legt fest, wie der nächste Tag gezählt wird:

* **Nach der Erledigung**: Der nächste Tag wird ab dem Tag gezählt, an dem du die Aufgabe erledigst. „Alle 3 Tage“ heißt drei Tage, nachdem du sie abgehakt hast.
* **Im Rhythmus des Fälligkeitsdatums**: Der nächste Tag wird ab dem Fälligkeitsdatum gezählt, „wöchentlich“ bleibt also am selben Wochentag. Erledigst du die Aufgabe zu spät, holt sie den nächsten Tag im Rhythmus ein, statt zu verrutschen.

### Was beim Erledigen passiert

Eine wiederkehrende Aufgabe zu erledigen (in **Erledigt** verschieben, den Kreis abhaken oder eine Sammelaktion) beendet sie nicht. Die Aufgabe **bleibt in ihrer Spalte** und:

* bekommt ihren nächsten Tag als **Fälligkeitsdatum** (wenn sie eines hat),
* wird bis zu diesem Tag **aufgeschoben** und taucht daher zur rechten Zeit wieder auf (siehe [Aufgaben aufschieben](./postponing)),
* verschiebt ihr geplantes Datum (wenn es ein Datum ist, kein Stichwort wie *diese Woche*) und ihre Erinnerungen um dieselbe Anzahl von Tagen,
* setzt ihre Checkliste zurück.

Es gibt immer **eine** Aufgabe, nie einen Stapel von Kopien. Verpasst du einen Tag, bleibt die Aufgabe einfach überfällig, bis du sie erledigst. Was du erledigt hast, steht in deinem Git-Verlauf, falls du Git nutzt.

Monatsschritte enden am Ende eines kürzeren Monats (31. Januar plus ein Monat ist der 28. Februar).

Auf dem Handy stellt **Rückgängig** in der Meldung nach dem Erledigen die alten Daten wieder her.

## Erinnerungen

Füge unter **Erinnerungen** in der Aufgabe einen oder mehrere Einträge mit Datum und Uhrzeit hinzu. Eine Erinnerung gilt nach der Wanduhr, wo immer du bist: 9:00 Uhr ist 9:00 Uhr in jeder Zeitzone.

**Auf dem Handy** sind Erinnerungen Android-Benachrichtigungen, die das System zur gewählten Zeit anzeigt, auch wenn Jotter geschlossen ist. Beim ersten Hinzufügen einer Erinnerung fragt Jotter nach der Erlaubnis für Benachrichtigungen. Jotter richtet die Erinnerungen ein, nachdem es den Vault gelesen hat. Eine am Desktop hinzugefügte Erinnerung ist auf dem Handy also eingerichtet, sobald die App das nächste Mal geöffnet wurde und synchronisiert ist. Erinnerungen werden nur für den geöffneten Vault ausgelöst: Wechselst du den Vault, ersetzen seine Erinnerungen die bisher eingerichteten. Ein Tipp auf die Benachrichtigung öffnet die Aufgabe. Schränkt Android genaue Alarme für die App ein, kann eine Erinnerung einige Minuten zu spät kommen.

**Am Desktop** sind Erinnerungen Browser-Benachrichtigungen, die **angezeigt werden, solange Jotter geöffnet ist** (ein Browser kann eine geschlossene Seite nicht wecken). Der Browser fragt mit der ersten Erinnerung nach der Erlaubnis. Eine Erinnerung, die bis zu 15 Minuten vor dem Öffnen von Jotter fällig war, wird trotzdem angezeigt.

Erinnerungen von Aufgaben in **Erledigt** oder **Archiv** werden nicht angezeigt. Eine Erinnerung wiederholt sich nicht von selbst: Für eine, die wiederkommt, mach die Aufgabe wiederkehrend und gib ihr eine Erinnerung. Sie wandert dann bei jeder Wiederkehr mit.

## In der Datei

```yaml
repeat:
  every: 2
  unit: week        # day, week, month oder year
  from: due         # completion (Standard) oder due
reminders:
  - "2026-10-14T09:00"
```

Die Einzelheiten stehen im [Dateiformat](./format-spec) und in der [Spezifikation](https://github.com/simon123h/Jotter/blob/main/spec/FORMAT.md).
