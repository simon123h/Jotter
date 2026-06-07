# Datensicherheit und Recovery

Jotter wurde von Grund auf so entwickelt, dass Daten-Sperren (Vendor Lock-in) verhindert werden und das Risiko von Datenbankfehlern vollständig ausgeschlossen ist. Im Gegensatz zu traditionellen Projektmanagement-Tools, die deine Daten in undurchsichtigen, herstellereigenen Datenbanken sichern, behandelt Jotter deine einfachen Markdown-Dateien auf deiner lokalen Festplatte als die einzige, absolute Quelle der Wahrheit.

Diese Seite beschreibt, wie Jotter die Sicherheit deiner Daten garantiert und wie du Backups und Wiederherstellungen im Notfall durchführst.

---

## Kernprinzipien der Sicherheit

Jotter arbeitet nach drei einfachen, grundlegenden Prinzipien für deine Sicherheit:

1. **Menschenlesbare Speicherung**: Jede Aufgabenkarte, jede Checkliste, jeder Tag und jede Frist wird als eigene `.md`-Datei mit standardisiertem YAML-Frontmatter und Markdown-Textkörper gespeichert.
2. **Lokales Arbeiten (Local-First)**: Jotter benötigt keine Cloud-Datenbanken, Webserver oder Internetverbindungen, um zu funktionieren. Deine Dateien verbleiben vollständig auf deiner eigenen Hardware unter deiner vollen Kontrolle.
3. **Keine Datenbank-Abhängigkeit**: Der Datenbank-Index (SQLite) ist rein temporär (ephemer) ausgelegt. Er dient ausschließlich dazu, Suchen, Filterungen und Sortierungen extrem zu beschleunigen. Er besitzt keine Daten-Hoheit.

---

## Wiederherstellung des temporären Index

Da die SQLite-Datenbank lediglich als schneller Zwischenspeicher (Cache) dient, ist dein Datenbestand absolut sicher, selbst wenn die Datenbankdatei gelöscht, beschädigt oder inkonsistent wird.

### Den Index neu aufbauen
Wenn du feststellst, dass deine Boardansicht nicht mehr den Dateien auf der Festplatte entspricht oder wenn du manuell Aufgaben-Dateien in den Ordner kopiert hast:
1. Öffne die Seitenleiste der Jotter-Anwendung.
2. Klicke ganz unten auf die Schaltfläche **Synchronisieren**.
3. Jotter scannt deine Ordner blitzschnell neu ein, löscht den veralteten Cache und baut den SQLite-Index komplett neu auf.

### Den Cache manuell zurücksetzen
Falls ein schwerwiegender Fehler im App-Index vorliegt und du die Datenbank komplett löschen möchtest:
1. Schließe die Jotter-Anwendung.
2. Navigiere zum App-Datenverzeichnis deines Benutzers:
   * **Linux**: `~/.config/jotter` oder `~/.gemini/antigravity-cli` (oder entsprechender App-Pfad)
   * **macOS**: `~/Library/Application Support/jotter`
   * **Windows**: `%APPDATA%\jotter`
3. Lösche die dort liegende Datenbankdatei (meist `index.db` oder `cache.db`).
4. Starte Jotter neu.
5. Klicke in der Seitenleiste auf **Synchronisieren**, um die Datenbank sauber aus deinen Original-Markdown-Dateien zu rekonstruieren.

---

## Backups erstellen

Da deine Daten in normalen Datei- und Ordnerstrukturen liegen, ist ein Backup so unkompliziert wie das Kopieren eines normalen Ordners. Du benötigst keine Export-Skripte oder SQL-Dumps.

### Manuelles Backup
Kopiere einfach deine Projektordner auf eine externe Festplatte, einen USB-Stick oder ein Netzlaufwerk:
```bash
cp -r ~/Code/jotter/projects/mein-board /media/backup/mein-board-backup
```

### Automatische Cloud-Backups
Du kannst jedes beliebige Cloud-Synchronisations-Tool verwenden, um deine Daten im Hintergrund zu sichern:
* **Dropbox / Google Drive / OneDrive**: Lege dein Jotter-Projektverzeichnis einfach in deinem synchronisierten Cloud-Ordner ab. Sobald Jotter eine `.md`-Datei speichert, lädt deine Cloud sie automatisch hoch und versioniert sie.
* **Proton Drive / Syncthing**: Funktioniert hervorragend mit dezentralen, verschlüsselten Dateisynchronisationen.

---

## Versionshistorie und Wiederherstellung

Da deine Aufgaben in einfachen Textdateien liegen, kannst du Bearbeitungshistorien einsehen und Fehler mithilfe von Standard-Versionskontrollen korrigieren.

### Git-Versionskontrolle
Wenn du die Git-Synchronisation nutzt, wird jede deiner Änderungen als eigenständiger Commit protokolliert.
* **Gelöschte Aufgabe wiederherstellen**: Wenn du versehentlich eine Aufgabenkarte gelöscht hast, kannst du sie aus der Git-Historie wieder zurückholen:
  ```bash
  git checkout HEAD~1 -- tasks/meine-versehentlich-geloeschte-aufgabe-id.md
  ```
* **Änderungsverlauf einsehen**: Du kannst im Terminal mit `git log -p tasks/aufgabe-id.md` die exakte Historie einer Aufgabe einsehen – wann sie verschoben wurde, welche Tags geändert wurden oder wann Notizen hinzugefügt wurden.
