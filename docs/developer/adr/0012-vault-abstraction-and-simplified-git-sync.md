# ADR 0012: Vault Abstraction and Local-Only Git Versioning

## Status
Accepted

## Context
Earlier versions of Jotter operated on a single global `data_dir` containing all projects. To enable users to collaborate with coworkers on specific projects, Jotter implemented selective per-project Git sync ([ADR 0008](./0008-selective-per-project-git-sync.md)). 

While functional, supporting both a global workspace repository and nested per-project sub-repositories introduced significant architectural complexity:
1. **Nested Git Repositories**: Managing submodules, nested `.git` folders, and dynamic `.gitignore` files was brittle and error-prone.
2. **Commit Traversal Complexity**: The "Time Machine" feature had to heuristically search both project subdirectories and parent directories to resolve commit history.
3. **Ambiguous Boundaries**: Users lacked a clean mental separation between completely private workspaces and shared team environments.
4. **Networking Out of Scope**: Remote management, credential handling, offline detection, and rebase/merge conflict recovery are a large surface area for a tool whose purpose is editing Kanban tasks.

Similar file-based Markdown productivity tools (like Obsidian) solve this problem by organizing workspaces into **Vaults**.

## Decision
We introduce a **Vault** abstraction above projects, establishing a clean hierarchy:
$$\text{Vault} \longrightarrow \text{Projects} \longrightarrow \text{Buckets} \longrightarrow \text{Tasks}$$

1. **Vault as the Unit of Physical Storage & Git Versioning**:
   - A Vault represents an isolated folder on disk.
   - Exactly **one Git repository** exists per Vault (1:1 mapping).
   - Each Vault maintains its own independent SQLite projection index (`tasks.db`).
   - The background filesystem watcher (`FileWatcherService`) monitors the active Vault directory.

2. **Local-Only Git Versioning**:
   - Complex nested repository detection is superseded by a single Vault Git root.
   - Jotter no longer performs any Git networking. All remote configuration (`git_remote` on projects and vaults, the global `gitRemoteUrl` setting) and the `pull`/`push`/offline-detection logic were removed.
   - `commit_changes` only stages and commits local changes, and only if the Vault directory already is a Git repository. Committing never initializes one.
   - Versioning is enabled per vault by an explicit user action (`POST /api/system/git/init`, the sidebar **Enable Git** button). It is refused when Git is missing or the vault already lies inside another work tree, to avoid nested repositories.
   - Jotter never overwrites an existing `user.name` / `user.email`; a missing value gets a fallback in the repository's local config only.
   - The local SQLite index (`tasks.db*`) is kept out of commits via `.git/info/exclude`.
   - Users who want to share a Vault add a remote themselves and push/pull with their own Git tooling, or use a file sync tool.
   - The "Time Machine" queries file revisions (`git log -- <project>/<task>.md`) directly from the Vault's single repository.
   - Existing project-level Git repos are retained as an automatic local fallback for backwards compatibility.

3. **Multi-Vault Switching**:
   - Vault registrations and the active vault are maintained in a global registry (`~/.config/jotter/vaults.json`).
   - Switching vaults re-targets the active directory, switches the SQLite database connection, runs initial reconciliation, and points the background file watcher to the new vault without restarting the server.
   - The frontend provides a dropdown switcher in the sidebar.

```mermaid
flowchart TD
    subgraph UI ["User Interface"]
        VS["Vault Switcher Dropdown"]
    end

    subgraph VaultPersonal ["Vault: Personal (~/Documents/Jotter)"]
        GitA[".git"]
        DB_A["tasks.db"]
        ProjA1["Project: Default"]
        ProjA2["Project: Home"]
    end

    subgraph VaultWork ["Vault: Work Team (~/Work/client-repo)"]
        GitB[".git"]
        DB_B["tasks.db"]
        ProjB1["Project: Sprint-Backlog"]
        ProjB2["Project: Architecture"]
    end

    VS -->|Active Vault| VaultPersonal
    VS -.->|Switch Active| VaultWork
```

## Consequences

### Positive
- **Architectural Clarity**: Decouples project organization from physical Git repository boundaries.
- **Git Reliability**: Eliminates nested repository conflicts and dynamic `.gitignore` overwriting.
- **Small Surface Area**: No credentials, network errors, or merge conflicts to handle inside Jotter.
- **Collaboration Stays Possible**: Users can clone coworker repositories as separate vaults and sync them with their own Git workflow.
- **Zero-Friction Migration**: Existing installations automatically seed the current `data_dir` as the `"default"` vault on startup.

### Negative / Trade-offs
- Users who previously relied on nested git repositories inside a single folder are encouraged to separate them into distinct vaults.
- Users who relied on Jotter to push and pull must now do so themselves. Previously configured remote URLs in `settings.json` and the SQLite index are ignored.
