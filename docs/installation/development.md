# Running from Source (Development)

This guide walks you through setting up a local development environment to run and modify Jotter.

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** (v22 or higher recommended) and **npm**
- **Python** (v3.12 or higher recommended)
- A terminal shell (Bash, Zsh, PowerShell)

## Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/simon123h/jotter.git
cd jotter
```

### 2. Automatic Dependency Installation

A workspace helper script is provided to install Node dependencies for both the root and frontend, set up a Python virtual environment (`.venv`) for the backend, and install all Python dependencies:

```bash
npm run install:all
```

---

## Running in Development Mode

To run both the backend (FastAPI) and the frontend (Vue 3 / Vite) concurrently with hot-reloading:

```bash
npm run dev
```

- The **Frontend** will be accessible at: `http://localhost:5173/` (or the port shown in your terminal).
- The **Backend API** will run at: `http://127.0.0.1:8000/`.
- The API interactive documentation (Swagger UI) is available at: `http://127.0.0.1:8000/docs`.

---

## Workspace Scripts

Several npm script wrappers are available at the root level for convenient development workflow:

| Command                | Description                                                       |
| :--------------------- | :---------------------------------------------------------------- |
| `npm run dev`          | Runs both backend and frontend concurrently with hot-reloads.     |
| `npm run build`        | Builds the frontend production bundle (`dist/`).                  |
| `npm run test`         | Executes both backend (Pytest) and frontend (Vitest) test suites. |
| `npm run lint`         | Lints the entire codebase (Ruff for python, ESLint for Vue).      |
| `npm run format`       | Auto-formats code (Ruff formatting + Prettier).                   |
| `npm run format:check` | Checks formatting without rewriting files.                        |

For individual components:

- **Backend commands** can be run inside the `backend/` directory using the virtual environment: `backend/.venv/bin/pytest`, `backend/.venv/bin/ruff check .`, etc.
- **Frontend commands** can be run inside the `frontend/` directory using standard npm commands: `npm run dev`, `npm run test`, `npm run lint`, etc.
