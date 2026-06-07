# Vorkompilierte Binärdateien ausführen

Jotter ist so konzipiert, dass es vollständig eigenständig ist. Du benötigst weder Python, Node.js noch andere Build-Tools auf deinem System, um es auszuführen.

Wir stellen vorkompilierte Einzeldatei-Anwendungen für Windows, Linux und macOS zur Verfügung.

---

## Welche Version sollte ich verwenden?

Das Release-Paket enthält zwei verschiedene Versionen von Jotter:

* **`jotter-desktop` (Für die meisten Benutzer empfohlen)**: Dies ist eine eigenständige Desktop-Anwendung. Sie öffnet sich in einem eigenen Fenster und verhält sich wie ein normales Desktop-Programm (ähnlich wie Obsidian oder Trello).
* **`jotter-server`**: Dies ist eine leichtgewichtige CLI/Server-Version. Sie läuft im Terminal und startet einen Webserver. Verwende diese Version, wenn du Jotter auf einem Headless-Server, in Docker oder einfach im eigenen Webbrowser nutzen möchtest.

---

## Installationsschritte

1. Gehe auf die [GitHub Releases](https://github.com/simon123h/jotter/releases) Seite des Repositories.
2. Lade das Paket herunter, das zu deinem Betriebssystem passt.
3. Entpacke das heruntergeladene Archiv.
4. Führe die Anwendung aus:
   * **Windows**: Doppelklicke auf `jotter-desktop.exe` für das App-Fenster oder führe `jotter-server.exe` in der Eingabeaufforderung für den Server-Modus aus.
   * **Linux / macOS**: Öffne dein Terminal, navigiere in den entpackten Ordner und führe Folgendes aus:
     ```bash
     chmod +x jotter*
     ./jotter-desktop  # Für die Desktop-App
     # ODER
     ./jotter-server   # Für den Server-Modus
     ```

---

## Nach dem Start

* Wenn du **`jotter-desktop`** startest, öffnet sich das Anwendungsfenster sofort.
* Wenn du **`jotter-server`** ausführst, wird ein lokaler Webserver gestartet (Standard-Port: `http://localhost:58271`). Du kannst dann auf die Benutzeroberfläche zugreifen, indem du diese Adresse in deinem Webbrowser öffnest.
