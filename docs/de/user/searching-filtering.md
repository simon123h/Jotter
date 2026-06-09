# Aufgaben suchen & filtern (DSL)

Jotter verfügt über eine leistungsstarke, tastaturgesteuerte Such-Domain-Specific-Language (DSL) direkt in der Suchleiste der Navigationsleiste. Dies ermöglicht es Power-Usern, Aufgaben in Boards, Listen und Zeitplänen mit maximaler Geschwindigkeit und Präzision zu filtern – unter Verwendung von Abfrageschlüsseln, die denen von GitHub, Jira oder Linear ähneln.

## Bidirektionale Synchronisation

Eines der nützlichsten Features von Jotters Suche ist die **bidirektionale Synchronisation**:
* **Eingabe von Abfragen**: Während Sie Filterkriterien in das Suchfeld eingeben, werden die entsprechenden Kontrollkästchen und Felder im **Filter-Modal** automatisch in Echtzeit aktualisiert.
* **Verwendung des Modals**: Wenn Sie das Filter-Modal visuell öffnen und ein Tag oder eine Priorität aktivieren, generiert Jotter sofort die korrekte DSL-Abfrage und fügt sie in das Suchfeld ein. Dies dient Ihnen als interaktive Anleitung, um die Syntax der Abfragesprache spielend leicht zu erlernen.

---

## Referenz der Abfragesyntax

Eine Suchabfrage setzt sich aus freiem Volltext (einzelne Wörter oder Phrasen in Anführungszeichen) und optionalen, durch Doppelpunkte getrennten Kriterien (`feld:wert`) zusammen. Freier Text wird als Volltextsuche auf Aufgabentitel und -beschreibungen angewendet.

| Filterkriterium | Abfrage-Beispiel | Beschreibung |
| :--- | :--- | :--- |
| **Volltextsuche** | `auth login` | Aufgaben, die sowohl "auth" als auch "login" im Titel oder der Beschreibung enthalten |
| **Exakte Phrase** | `"fix memory leak"` | Aufgaben, die exakt die Phrase "fix memory leak" enthalten |
| **Tags (ODER-Match)** | `tags:ui,bug` <br> *oder* `tag:ui,bug` | Aufgaben, die **entweder** das Tag `ui` **oder** `bug` besitzen |
| **Tags (UND-Match)** | `tags:ui+bug` <br> *oder* `tag:ui+bug` | Aufgaben, die **sowohl** das Tag `ui` **als auch** `bug` besitzen müssen |
| **Spalten/Buckets** | `bucket:todo` <br> *oder* `buckets:todo,progress` | Aufgaben, die sich in den angegebenen Spalten befinden |
| **Prioritäten** | `priority:high` <br> *oder* `prio:high,urgent` | Aufgaben mit den angegebenen Prioritätsstufen |
| **Projekte** | `project:marketing` <br> *oder* `proj:frontend` | Aufgaben, die zu einem Projekt nach ID oder **Projekttitel** gehören |
| **Vorhandensein von Fälligkeit** | `due:has` <br> *oder* `due:none` | Aufgaben, die ein beliebiges Fälligkeitsdatum bzw. *kein* Fälligkeitsdatum haben |
| **Fälligkeitsgrenzen** | `due:before:2026-12-31` <br> `due:after:2026-06-01` | Aufgaben, deren Fälligkeitsdatum innerhalb der angegebenen Grenzen liegt |

---

## Kombinieren von Abfragen

Alle separaten Feldkriterien in Ihrer Abfrage werden mit einem logischen `UND` verknüpft. Kommata `,` innerhalb von Feldwerten stehen für ein logisches `ODER`.

### Beispiele:

1. **Aufgaben mit hoher Priorität und dem Tag "bug" in der Spalte "todo":**
   ```text
   tag:bug priority:high bucket:todo
   ```
   *Filtert nach Aufgaben, die mit `bug` taggtiert sind **UND** die Priorität `high` haben **UND** sich in der Spalte `todo` befinden.*

2. **UI- oder UX-Aufgaben, die vor Mitte Dezember fällig sind:**
   ```text
   tags:ui,ux due:before:2026-12-15
   ```
   *Filtert nach Aufgaben mit den Tags `ui` **ODER** `ux` **UND** einem Fälligkeitsdatum vor dem 15. Dezember 2026.*

3. **Datenbankaufgaben im Frontend-Projekt ohne Fälligkeitsdatum:**
   ```text
   project:frontend due:none database
   ```
   *Filtert nach Aufgaben, die zum Projekt "frontend" gehören (nach Titel oder ID) **UND** kein Fälligkeitsdatum haben **UND** das Wort "database" im Titel oder der Beschreibung enthalten.*

4. **Kritische Frontend-UI-Fehler (Sowohl UI als auch Bug erforderlich):**
   ```text
   proj:frontend tags:ui+bug prio:high,urgent
   ```
   *Filtert nach Aufgaben im Projekt "frontend" **UND** mit den Tags `ui` **UND** `bug` **UND** einer Priorität von entweder `high` oder `urgent`.*
