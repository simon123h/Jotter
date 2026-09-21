# Running from Source (Development)

This guide walks you through setting up a local development environment to run and modify Jotter.

## Prerequisites

Ensure you have the following installed on your machine:

- **Python** (v3.12 or higher) and **pip**
- **Node.js** (v20 or higher recommended) and **npm**
- A terminal shell (Bash, Zsh, PowerShell)

## Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/simon123h/jotter.git
cd jotter
```

### 2. Dependency Installation

A workspace helper script is provided to install Node dependencies for both the root and frontend, and install Python dependencies in editable mode:

```bash
npm run install:all
```

Or manually:

```bash
# Backend dependencies
pip install -e .[dev]

# Frontend dependencies
npm install
cd frontend && npm install && cd ..
```

---

## Running in Development Mode

To run both the Python FastAPI backend and the Vue 3 frontend concurrently with hot-reloading:

```bash
npm run dev
```

Or run each service separately in dedicated terminal sessions:

```bash
# Terminal 1: Python Backend
npm run dev:backend
# or: python3 run.py

# Terminal 2: Vue 3 Frontend
npm run dev:frontend
# or: cd frontend && npm run dev
```

The frontend will run at `http://localhost:5173` (proxying `/api` requests to the Python server at `http://localhost:58271`).

---

## Running Tests

```bash
# Run all tests (Backend Pytest + Frontend Vitest)
npm run test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run Playwright full-stack browser E2E tests
cd frontend && npx playwright test
```

---

## Android Mobile Development & Local Preview

Jotter's mobile version is built with **Capacitor** and runs in-process with a client-side storage engine (IndexedDB cache via Dexie.js + raw `.md` filesystem access).

### 1. Building the Android Project

```bash
# Build frontend web bundle and sync native Capacitor Android project
npm run cap:sync

# (Optional) Build release APK locally via Gradle
cd frontend/android && ./gradlew assembleRelease
```

### 2. Previewing the Mobile App on Linux / Desktop

You can test and preview the mobile application locally without flashing an APK to a physical phone using three methods:

#### Option A: Browser Mobile DevTools (Instant, Zero Setup)
1. Start the frontend: `cd frontend && npm run dev`
2. Open DevTools in Chrome/Firefox (`F12`), press `Ctrl + Shift + M` to toggle the **Device Toolbar / Mobile View** (e.g., Pixel 7).
3. The responsive layout will automatically switch to the mobile layout (bottom bar, compact columns, touch delays).

#### Option B: Waydroid (Native Linux Container – Fastest & Direct APK execution)
If you are running Linux on Wayland, **Waydroid** runs Android inside an LXC container directly with GPU acceleration:
```bash
# Start Waydroid session
waydroid session start

# Install the built APK
waydroid app install frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

#### Option C: Android Studio & Emulator
```bash
# Open the Android workspace in Android Studio
cd frontend && npx cap open android
```
From Android Studio, click **Run** (▶) or launch an Android Virtual Device (AVD) from the Device Manager. Drag & drop the `.apk` directly onto the emulator window to install and test.
