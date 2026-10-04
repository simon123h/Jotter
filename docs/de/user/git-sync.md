# Git-Versionierung und Time Machine

Jotter kann eine lokale Git-Historie deines Vaults führen. Jeder Schnappschuss ist ein gewöhnlicher Git-Commit. Darauf baut die integrierte **Time Machine** auf, und du kannst Änderungen mit jedem Git-Werkzeug einsehen oder zurückrollen.

Jotters Git-Integration ist bewusst **rein lokal**: Jotter erstellt Commits, führt aber niemals Push oder Pull aus und kommuniziert mit keinem Remote. Das Teilen eines Vaults über mehrere Geräte oder im Team bleibt den dafür gemachten Werkzeugen überlassen (siehe [Synchronisation über mehrere Geräte](#synchronisation-uber-mehrere-gerate)).

---

## Git-Versionierung aktivieren

Die Versionierung ist pro Vault freiwillig. Jotter legt niemals ungefragt ein Git-Repository an.

1. Stelle sicher, dass `git` installiert und im `PATH` verfügbar ist.
2. Klicke unten in der Seitenleiste auf **Git aktivieren**. Jotter legt im aktiven Vault ein Git-Repository an und erstellt einen ersten Commit. Ist Git nicht installiert, ist die Schaltfläche deaktiviert.
3. An ihrer Stelle erscheinen die Schaltfläche **Commit** und die Time Machine.

Liegt ein Vault bereits in einem anderen Git-Repository, lehnt Jotter die Aktivierung ab, um verschachtelte Repositories zu vermeiden. Nutze in diesem Fall das umgebende Repository direkt oder verschiebe den Vault in einen eigenen Ordner.

Wenn du das Terminal bevorzugst: `git init` im Vault-Ordner (zu finden unter **Einstellungen → Systeminformationen**) hat denselben Effekt.

---

## So entstehen Commits

* **Manuell**: Klicke in der Seitenleiste auf **Commit**. Jotter staged alle Änderungen im Vault und committet sie mit einem Zeitstempel (`jotter: auto-sync <Datum>`). Gibt es keine Änderungen, entsteht kein Commit.
* **Automatisch**: Unter **Einstellungen → Git-Versionierung** kannst du ein **Auto-Commit-Intervall** wählen, damit im Hintergrund Schnappschüsse entstehen, solange Jotter geöffnet ist.
* **Identität**: Commits verwenden dein Git-`user.name` und `user.email`. Nur wenn keine konfiguriert sind, setzt Jotter einen Fallback (`Jotter`) in der lokalen Konfiguration dieses Repositories und überschreibt niemals eine vorhandene Identität.
* **Index bleibt lokal**: Der SQLite-Index (`tasks.db`) ist ein jederzeit neu aufbaubarer Cache und wird nicht mit committet.

---

## Time Machine (Versions-Wiederherstellung)

Jotter verfügt über eine integrierte **Time Machine**-Funktion, mit der du deinen Arbeitsbereich oder bestimmte Projekte direkt über die Benutzeroberfläche auf jeden beliebigen Zustand in deiner Git-Historie zurücksetzen kannst.

Dies bietet eine risikofreie Umgebung für Experimente, versehentliches Löschen oder das Ansehen früherer Zustände deiner Boards.

### So greifst du auf die Time Machine zu
1. Suche in der Seitenleiste die Schaltfläche **Commit** ganz unten.
2. Klicke auf das kleine **Verlauf-Symbol** (History) rechts neben der Commit-Schaltfläche.
3. Dadurch öffnet sich das Overlay der **Time Machine**, das die letzten 10 Schnappschüsse (Commits) deines Repositories anzeigt.
4. Jeder Schnappschuss zeigt:
   * Die **Nachricht** des Commits.
   * Den **Autor**, der die Änderung vorgenommen hat.
   * Das **Datum und die Uhrzeit** des Schnappschusses.
   * Die abgekürzte **Git-Commit-ID** (z.B. `8b5f800`).

### Einen Schnappschuss wiederherstellen (Perfekter Undo-Mechanismus)
Wenn du auf einen Schnappschuss klickst, um ihn wiederherzustellen, führt Jotter im Hintergrund eine robuste Git-Wiederherstellung durch, die immer vorwärtsgerichtet ist:

1. **Automatisches Backup vor der Wiederherstellung**: Jotter prüft zuerst, ob ungespeicherte Änderungen oder Entwürfe in deinem Arbeitsverzeichnis vorliegen. Falls vorhanden, werden diese automatisch gestaged und committet (`backup: snapshot before restoring to <hash>`). Dies garantiert **vollständigen Schutz vor Datenverlust**—du kannst jederzeit wieder zum aktuellen Stand zurückkehren!
2. **Hard-Reset**: Es wird ein sauberer Reset durchgeführt, um die Dateien exakt an den Ziel-Commit anzupassen (gelöschte und neue, ungetrackte Dateien werden dabei sauber bereinigt).
3. **Soft-Reset & Vorwärts-Commit**: Jotter setzt den Git-Pointer zurück, ohne die Historie zu überschreiben oder zu verändern. Der wiederhergestellte Stand wird als neuer Revert-Commit erfasst (`revert: restore workspace to commit <hash>`).
4. **Kein Überschreiben der Historie**: Dieses Verfahren schreibt die Git-Historie linear fort und löscht niemals bestehende Commits.
5. **Datenbank-Reindexierung**: Sobald die Dateien auf der Festplatte wiederhergestellt wurden, reindexiert Jotter im Hintergrund die SQLite-Datenbank. Dein Aufgabenboard, die Spalten und die Filter aktualisieren sich sofort in der App.

> [!TIP]
> Da vor jeder Wiederherstellung automatisch ein Backup-Schnappschuss angelegt wird, kannst du eine Wiederherstellung jederzeit rückgängig machen, indem du in der Time Machine einfach den entsprechenden Backup-Eintrag auswählst!

---

## Synchronisation über mehrere Geräte

Da ein Vault ein einfacher Ordner mit Markdown-Dateien (und optional ein gewöhnliches Git-Repository) ist, kannst du ihn mit den Werkzeugen synchronisieren, die du ohnehin nutzt:

* **Dateisynchronisation**: Syncthing, Dropbox, Nextcloud und ähnliche Tools funktionieren ohne weitere Einrichtung. Jotters Dateisystem-Watcher übernimmt eingehende Änderungen automatisch.
* **Git-Remote**: Richte selbst ein Remote ein und nutze deinen gewohnten Git-Workflow für Push und Pull:
  ```bash
  git remote add origin git@github.com:username/my-jotter-vault.git
  git push -u origin main
  ```
  Jotters Schnappschüsse sind normale Commits und werden wie alle anderen gepusht. Authentifizierung und Merge-Konflikte löst du direkt mit Git, außerhalb von Jotter. Nach einem Pull indexiert Jotter die geänderten Dateien automatisch neu.
