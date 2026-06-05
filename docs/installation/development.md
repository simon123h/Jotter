# Running from Source (Development)

This guide walks you through setting up a local development environment to run and modify Jotter.

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** (v22 or higher recommended) and **npm**
- **Go** (v1.25.0 or higher)
- **Wails CLI** (optional, required to build/run the desktop app from source):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
- A terminal shell (Bash, Zsh, PowerShell)

## Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/simon123h/jotter.git
cd jotter
```

### 2. Dependency Installation

A workspace helper script is provided to install Node dependencies for both the root and frontend, and download all Go backend dependencies:

```bash
npm run install:all
```

---

## Running in Development Mode

You can run Jotter in either Browser/Web mode or as a native Wails Desktop Application.

### Option A: Wails Desktop Mode (Recommended)

To run Jotter in developer desktop mode (interactive desktop window with hot-reloading support for both Go and Vue):

```bash
npm run dev
# or directly
wails dev
```

### Option B: Web / Server Mode

To run both the Go REST API server and the frontend (Vue 3 / Vite) concurrently in your web browser with hot-reloading:

```bash
npm run dev:backend
# and in another terminal
npm run dev:frontend
```

---

## Workspace Scripts

Several npm script wrappers are available at the root level for convenient development workflow:

| Command                 | Description                                                           |
| :---------------------- | :-------------------------------------------------------------------- |
| `npm run dev`           | Standard dev mode: launches the Wails desktop window with hot-reload. |
| `npm run build`         | Builds both the `jotter` (server) and `jotter-desktop` binaries.      |
| `npm run build:server`  | Builds only the server binary.                                        |
| `npm run build:desktop` | Builds only the desktop binary.                                       |
| `npm run test`          | Executes both backend (Go test) and frontend (Vitest) test suites.    |
| `npm run lint`          | Lints the entire codebase.                                            |
| `npm run format`        | Auto-formats code.                                                    |

For individual components:

- **Backend commands** can be run in the root directory: `go test -v ./...`, `go vet ./...`, `go fmt ./...`, etc.
- **Frontend commands** can be run inside the `frontend/` directory using standard npm commands: `npm run dev`, `npm run test`, `npm run lint`, etc.
