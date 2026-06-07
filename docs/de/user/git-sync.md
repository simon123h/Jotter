# Git-Synchronisation und Zusammenarbeit

Jotter verfügt über eine tiefe, automatisierte Git-Integration im Hintergrund. Wenn du deine Boards mit einem Git-Remote-Repository (z. B. auf GitHub, GitLab, Gitea oder einem eigenen Server) verbindest, kannst du deine Daten automatisch sichern und über mehrere Rechner hinweg synchron halten.

Diese Seite beschreibt die Einrichtung, Authentifizierung und das kollaborative Arbeiten auf Basis einfacher Textdateien.

---

## Funktionsweise der Synchronisation

Sobald die Git-Integration für ein Projekt aktiviert ist, agiert Jotter als stiller Versionskontroll-Assistent im Hintergrund:

* **Automatisches Rebuild-Triggering**: Wenn du eine Synchronisation anstößt (entweder manuell über die Schaltfläche **Synchronisieren** in der Seitenleiste oder im Hintergrund), führt Jotter im Hintergrund Git-Aktionen aus.
* **Intelligente Commits**: Jotter erkennt erstellte, geänderte oder gelöschte Aufgabendateien, fügt sie zur Versionskontrolle hinzu und committet sie mit strukturierten Commit-Nachrichten.
* **Upstream-Abgleich**: Es führt ein `git pull --rebase` aus, um Änderungen von anderen Geräten herunterzuladen, integriert diese und führt anschließend ein `git push` aus, um deine Änderungen hochzuladen.

---

## Ein Git-Remote einrichten

Du kannst die Git-Synchronisation entweder global für deinen gesamten Arbeitsbereich oder individuell für jedes Projekt einzeln konfigurieren.

### Einzelsynchronisation für ein Projekt einrichten
1. Öffne die Seitenleiste, fahre über das gewünschte Projekt und klicke auf das Stift-Symbol (**Projekt bearbeiten**).
2. Trage in das Feld **Git-Remote-URL** die Git-Adresse deines Repositories ein:
   * **SSH**: `git@github.com:benutzername/mein-jotter-board.git` (Empfohlen)
   * **HTTPS**: `https://github.com/benutzername/mein-jotter-board.git`
3. Klicke auf **Speichern**.

### Globale Synchronisation einrichten
Wenn du alle deine Projekte und Boards in einem einzigen zentralen Ordner aufbewahrst:
1. Öffne die **Einstellungen** über das Zahnrad-Symbol in der Seitenleiste.
2. Trage die Repository-Adresse unter **Globale Git-Remote-URL** ein.
3. Sobald diese gespeichert ist, verwaltet Jotter die Synchronisation für deinen gesamten Arbeitsbereich.

---

## Authentifizierung und Sicherheit

Jotter nutzt die lokal auf deinem Computer installierte Git-Umgebung. Dadurch werden alle dort hinterlegten Keys, Passwörter und Sicherheitskonfigurationen automatisch übernommen.

### Authentifizierung per SSH (Empfohlen)
Wir empfehlen dringend die Verwendung von SSH-URLs (`git@github.com:...`).
* Wenn deine SSH-Schlüssel im lokalen SSH-Agenten geladen und bei GitHub/GitLab registriert sind, kann sich Jotter im Hintergrund völlig lautlos ohne Passwort-Abfragen authentifizieren.
* Stelle sicher, dass du deinen SSH-Schlüssel vor dem Start von Jotter mit `ssh-add` geladen hast.

### Authentifizierung per HTTPS und Token
Falls du HTTPS-URLs (`https://github.com/...`) bevorzugst:
* Richte den lokalen Git-Credential-Helper ein, um deine Anmeldedaten zu speichern:
  ```bash
  git config --global credential.helper store
  ```
* Beim ersten manuellen Push oder Pull wirst du nach Benutzername und Passwort gefragt. Verwende hierbei ein **Personal Access Token (PAT)** anstelle deines normalen Account-Passworts. Sobald die Daten gespeichert sind, läuft die Synchronisation automatisch im Hintergrund.

---

## Nutzung auf mehreren Geräten und im Team

Da Git Konflikte in Textdateien hervorragend verarbeiten kann, kannst du denselben Aufgabenordner auf mehreren Rechnern parallel nutzen oder sogar im Team bearbeiten.

### Normaler Ablauf
Wenn du Jotter auf einem Gerät startest, klicke einfach auf **Synchronisieren**. Es lädt die neuesten Stände herunter, pflegt sie in den SQLite-Index ein und aktualisiert das Board. Sobald du Karten bewegst oder bearbeitest, werden lokale Commits erzeugt und direkt hochgeladen, sodass sie für deine anderen Rechner bereitstehen.

### Umgang mit Merge-Konflikten
In seltenen Fällen, wenn dieselbe Zeile einer Aufgabendatei auf zwei Computern exakt gleichzeitig geändert wurde, kann ein Git-Merge-Konflikt entstehen.
* **Auswirkung in Jotter**: Da Jotter im Hintergrund ein `git pull --rebase` ausführt, wird die Synchronisation bei einem Konflikt gestoppt, um Datenverlust zu verhindern. Es wird ein Fehler protokolliert.
* **Lösung des Konflikts**:
  1. Öffne ein Terminal und wechsle in deinen Projektordner.
  2. Führe `git status` aus, um die betroffenen Dateien zu identifizieren.
  3. Öffne die konfliktbehafteten `.md`-Dateien im Editor deiner Wahl. Die Git-Konfliktmarker (`<<<<<<< HEAD` und `>>>>>>>`) zeigen dir genau die Unterschiede.
  4. Bereinige die Stellen, speichere die Dateien ab und führe im Terminal aus:
     ```bash
     git add tasks/konflikt-aufgabe.md
     git rebase --continue
     ```
  5. Sobald der Rebase abgeschlossen ist, ist dein lokales Git wieder sauber. Ein Klick auf **Synchronisieren** in der Jotter-Seitenleiste setzt die automatische Synchronisation fort.
