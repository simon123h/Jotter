# Contributing to Jotter

Thank you for your interest in contributing to Jotter! We welcome issues, suggestions, and pull requests to help make Jotter the best local-first task manager.

---

## Code of Conduct & Committing Rules

To maintain a clean and trackable history, we enforce the following rules:

### 1. Conventional Commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This helps automate releases and changelogs.

Format: `<type>(<scope>): <description>`

Common types:

- `feat`: A new feature for the user
- `fix`: A bug fix for the user
- `docs`: Documentation changes
- `style`: Code formatting changes (Prettier/Ruff format)
- `refactor`: Restructuring code without changing functionality
- `test`: Adding or correcting tests
- `chore`: Maintenance tasks, dependencies updates

Example:

```bash
feat(frontend): support keyboard autocomplete tags list in details modal
fix(backend): expand home user path in config data directory resolution
```

### 2. Semi-Linear Git History

We prefer a **semi-linear git history with merge commits** for features.

- Keep your feature branch updated by **rebasing** it onto the latest `main` branch. Bypassing this with a reverse merge (`git merge main` inside your feature branch) is discouraged as it creates messy commit loops.
- Pull requests will be integrated using a merge commit (`git merge --no-ff`) to ensure feature boundaries are cleanly documented in the commit graph, while keeping the history clean and readable.

### 3. Development Setup

Please refer to the [Development Setup Guide](docs/installation/development.md) for instructions on setting up your local environment, installing dependencies, and running the dev servers.

---

## Code Quality Standards

Before submitting a pull request, please ensure your changes adhere to our style and testing checks.

### Formatting & Linting

Run the following commands from the root directory to verify code cleanliness:

```bash
# Auto-format both Python and Vue/TypeScript files
npm run format

# Run linters on the entire project
npm run lint
```

- **Python Backend**: Uses **Ruff** for linting and formatting.
- **Frontend UI**: Uses **ESLint** and **Prettier** for code formatting and TypeScript linting.

### Testing

We require all tests to pass before merging. You can run all backend (Pytest) and frontend (Vitest) tests using:

```bash
npm run test
```

#### Testing Philosophy: Sociable over Solitary

We advocate for **sociable unit and integration tests** over solitary testing styles that mock internal collaborators:

* **Mock ONLY External Boundaries**: Only mock boundaries that are slow, stateful, or outside our control. Examples include HTTP requests (`fetch`), direct filesystem access, and specific browser-only APIs.
* **Keep Internal Collaborators Live**: Do not mock internal application code (e.g., Pinia stores, helper functions, data parsers, utility classes). Use them live in your tests.
* **Why**: This prevents fragile tests that break during internal refactorings, ensures genuine integration safety, and keeps test code readable and clear of setup boilerplate.

---

## Pull Request Process

1. Create a feature branch off of `main` (e.g. `feat/my-new-feature` or `fix/issue-description`).
2. Make your changes and commit them using conventional commit messages.
3. Ensure formatting, linting, and tests all pass cleanly.
4. Push your branch and open a Pull Request targeting `main`.
5. Clearly describe the changes and screenshots of UI modifications where relevant.
