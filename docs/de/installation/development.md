# Aus Quellcode ausführen (Entwicklung)

Diese Anleitung führt dich durch die Einrichtung einer lokalen Entwicklungsumgebung, um Jotter auszuführen und zu modifizieren.

---

## Voraussetzungen

Stelle sicher, dass die folgenden Programme auf deinem System installiert sind:

* **Python** (v3.12 oder höher) und **pip**
* **Node.js** (v20 oder höher empfohlen) und **npm**
* Eine Terminal-Shell (Bash, Zsh, PowerShell)

---

## Einrichtungsschritte

### 1. Repository klonen

```bash
git clone https://github.com/simon123h/jotter.git
cd jotter
```

### 2. Abhängigkeiten installieren

Verwende das Workspace-Skript, um alle Node- und Python-Abhängigkeiten im Entwicklungsmodus zu installieren:

```bash
npm run install:all
```

Oder manuell:

```bash
pip install -e .[dev]
npm install
cd frontend && npm install && cd ..
```

---

## Im Entwicklungsmodus ausführen

Um sowohl das Python-FastAPI-Backend als auch das Vue 3-Frontend mit Hot-Reloading gleichzeitig auszuführen:

```bash
npm run dev
```

Oder in separaten Terminals:

```bash
# Terminal 1: Python Backend
npm run dev:backend
# oder: python3 run.py

# Terminal 2: Frontend
npm run dev:frontend
# oder: cd frontend && npm run dev
```

Das Frontend ist unter `http://localhost:5173` erreichbar (leitet `/api` an das Python-Backend auf Port `58271` weiter).

---

## Tests ausführen

```bash
# Alle Tests ausführen (Pytest + Vitest)
npm run test

# Nur Backend-Tests (Pytest)
npm run test:backend

# Nur Frontend-Tests (Vitest)
npm run test:frontend

# Playwright E2E-Tests
cd frontend && npx playwright test
```

---

## Android App Entwicklung & Lokale Vorschau

Die Android-Version von Jotter basiert auf **Capacitor** und nutzt eine lokale Storage-Engine (Dexie.js IndexedDB-Cache + direkter `.md`-Dateizugriff).

### 1. Android-Projekt bauen

```bash
# Frontend bauen und mit dem nativen Capacitor-Projekt synchronisieren
npm run cap:sync

# (Optional) Release-APK lokal via Gradle kompilieren
cd frontend/android && ./gradlew assembleRelease
```

### 2. Lokale Vorschau auf Linux / Desktop

Die Android-App kann ohne echtes Smartphone auf drei Wegen lokal getestet und vorgeschaut werden:

#### Option A: Browser Mobile DevTools (Sofort, ohne Installation)
1. Frontend starten: `cd frontend && npm run dev`
2. Entwicklertools in Chrome/Firefox öffnen (`F12`), `Strg + Umschalt + M` drücken, um die **Geräteleiste / Mobile Ansicht** zu aktivieren (z. B. Pixel 7).
3. Das Layout schaltet automatisch in die mobile Ansicht (untere Navigationsleiste, kompakte Spalten, Touch-Verzögerungen).

#### Option B: Waydroid (Nativer Linux-Container – Schnellste native Ausführung)
Unter Linux mit Wayland führt **Waydroid** Android in einem LXC-Container mit voller GPU-Beschleunigung aus:
```bash
# Waydroid-Sitzung starten
waydroid session start

# Gebautes APK installieren
waydroid app install frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

#### Option C: Android Studio & Emulator
```bash
# Projekt in Android Studio öffnen
cd frontend && npx cap open android
```
In Android Studio auf **Run** (▶) klicken oder ein Virtual Device (AVD) starten. Das `.apk` kann auch per Drag & Drop direkt auf das Emulator-Fenster gezogen werden.
