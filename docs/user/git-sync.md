# Git Versioning and Time Machine

Jotter can keep a local Git history of your vault. Every snapshot is a regular Git commit, which powers the built-in **Time Machine** and lets you inspect or roll back changes with any Git tool.

Jotter's Git integration is deliberately **local-only**: it creates commits, but it never pushes, pulls, or talks to a remote. Sharing a vault across devices or with a team is left to the tools built for that job (see [Syncing Across Devices](#syncing-across-devices)).

---

## Enabling Git Versioning

Versioning is opt-in per vault. Jotter never creates a Git repository without you asking for it.

1. Make sure `git` is installed and available on your `PATH`.
2. Click **Enable Git** at the bottom of the sidebar. Jotter creates a Git repository in the active vault and records an initial commit. The button is disabled if Git is not installed.
3. The **Commit** button and the Time Machine appear in its place.

Jotter refuses to enable Git for a vault that already lies inside another Git repository, to avoid nested repositories. In that case, use the enclosing repository directly or move the vault to its own folder.

If you prefer the terminal, running `git init` in the vault folder (shown under **Settings → System Information**) has the same effect.

---

## How Commits Are Created

* **Automatic**: While Jotter is open, every change you make is committed automatically a few seconds later. Jotter stages all changes in the vault and commits them with a message that summarizes the changes (e.g. `jotter: 3 tasks created, 4 modified, 1 deleted`), followed by the titles of the changed tasks (up to 20). If nothing changed, no commit is created. There is no manual commit button. To keep the history readable, there is at most one automatic commit per minute: changes made within that minute are collected into one commit at its end. Pending changes are committed when Jotter shuts down or you switch vaults. Edits made outside Jotter (e.g. in a text editor) are picked up as well. There is nothing to configure.
* **Identity**: Commits use your Git `user.name` and `user.email`. Only if none is configured does Jotter set a fallback (`Jotter`) in that repository's local config, and it never overrides an existing identity.
* **Index stays local**: The SQLite index (`tasks.db`) is a rebuildable cache and is excluded from commits.

---

## Time Machine (Version Rollbacks)

Jotter includes a built-in **Time Machine** feature that allows you to roll your workspace or specific projects back to any snapshot in your Git history directly from the user interface. 

This provides a zero-risk environment for experiments, accidental deletes, or viewing earlier states of your boards.

### How to Access the Time Machine
1. In the sidebar, locate the **Commit** button at the bottom.
2. Click the small **History** icon on the right side of the Commit button.
3. This will open the **Time Machine Modal Dialog** - a spacious, dedicated overlay designed to view, search, and navigate your project snapshots comfortably.
4. Each snapshot shows:
   * A **Current State** badge (on the latest commit).
   * The **Message** of the snapshot/commit.
   * The **Author** who made the change.
   * The **Date and Time** of the snapshot.
   * The abbreviated **Git commit hash** (e.g., `8b5f800`) with a "Copy Full Hash" helper.

### Advanced Filtering
The Time Machine dialog includes a **Search Bar** at the top. You can type keywords to instantly filter snapshots by:
- Part of a commit message
- Commit author name
- Git commit hash (full or abbreviated)

### Restoring a Snapshot (Perfect Undo Mechanism)
When you click on **Restore State** for any snapshot, Jotter executes a bulletproof, forward-progressing Git restoration behind the scenes:

1. **Automatic pre-restore backup**: Jotter first checks if there are any uncommitted changes or drafts in your directory. If found, it stages and automatically commits them as an auto-saved snapshot (`backup: snapshot before restoring to <hash>`). This ensures **zero data loss**—you can always restore back to the present moment!
2. **Hard reset**: It runs a clean reset to match the files precisely to the target commit (handling deleted and untracked files properly).
3. **Soft reset & forward-progressing commit**: It moves the reference pointer back while preserving the Git history as linear and forward-progressing. It then commits the restored state as a new revert-restore commit (`revert: restore workspace to commit <hash>`).
4. **No history rewrite**: This workflow is highly robust and **never** deletes history or detaches the `HEAD` pointer, so your Git history stays linear and intact.
5. **Database Re-indexing**: Once the files on disk are restored, Jotter automatically re-indexes the SQLite database. Your task board, columns, and filters refresh instantly in the user interface to match the restored snapshot.

> [!TIP]
> Since every restoration creates an automatic pre-restore backup snapshot, you can use the Time Machine itself to "undo" a restore at any time by simply selecting the backup snapshot in the history list!

---

## Syncing Across Devices

Because a vault is a plain folder of Markdown files (and optionally a plain Git repository), you can sync it with whatever you already use:

* **File sync**: Syncthing, Dropbox, Nextcloud, or similar tools work out of the box. Jotter's filesystem watcher picks up incoming changes automatically.
* **Git remote**: Add a remote yourself and push/pull with your regular Git workflow:
  ```bash
  git remote add origin git@github.com:username/my-jotter-vault.git
  git push -u origin main
  ```
  Jotter's snapshots are ordinary commits, so they are pushed like any other. Authentication and merge conflicts are handled by Git itself, outside of Jotter. After pulling, Jotter re-indexes the changed files automatically.
