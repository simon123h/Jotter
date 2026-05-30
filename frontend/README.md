# Jotter - Frontend

A local-first Markdown Kanban board application built with Vue 3 and TypeScript, communicating with a Python/SQLite backend.

## Project Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

## Development

### Run the Development Server

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Build for Production

Build the application for production:

```bash
npm run build
```

The production build will be created in the `dist/` directory.

## Notes

- The frontend communicates with the backend API at `http://localhost:8000`
- Ensure the backend server is running before starting the frontend development server
