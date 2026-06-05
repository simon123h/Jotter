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

### Option A: Browser / Web Mode (Default)

To run both the Go REST API server and the frontend (Vue 3 / Vite) concurrently with hot-reloading:

```bash
npm run dev
```

- The **Frontend** will be accessible at: `http://localhost:5173/` (or the port shown in your terminal).
- The **Backend API** will run at: `http://127.0.0.1:8000/`.

### Option B: Wails Desktop Mode

To run Jotter in developer desktop mode using Wails (interactive desktop window with hot-reloading support):

```bash
wails dev
```

---

## Workspace Scripts

Several npm script wrappers are available at the root level for convenient development workflow:

| Command                | Description                                                       |
| :--------------------- | :---------------------------------------------------------------- |
| `npm run dev`          | Runs both backend and frontend concurrently with hot-reloads.     |
| `npm run build`        | Builds the frontend production bundle (`dist/`).                  |
| `npm run test`         | Executes both backend (Go test) and frontend (Vitest) test suites. |
| `npm run lint`         | Lints the entire codebase (Go vet + ESLint for Vue).               |
| `npm run format`       | Auto-formats code (Go fmt + Prettier).                             |
| `npm run format:check` | Checks formatting without rewriting files.                        |

For individual components:

- **Backend commands** can be run in the root directory: `go test -v ./...`, `go vet ./...`, `go fmt ./...`, etc.
- **Frontend commands** can be run inside the `frontend/` directory using standard npm commands: `npm run dev`, `npm run test`, `npm run lint`, etc.
