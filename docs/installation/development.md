# Running from Source (Development)

This guide walks you through setting up a local development environment to run and modify Jotter.

## Prerequisites

Ensure you have the following installed on your machine:

- **Python** (v3.10 or higher) and **pip**
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
