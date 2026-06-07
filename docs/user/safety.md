# Disaster Recovery and Data Safety

Jotter was designed from the ground up to prevent data lock-in and eliminate the risk of database corruption. Unlike traditional Kanban tools that store your valuable records in opaque, proprietary binary databases, Jotter treats your plain-text Markdown files on your local hard drive as the single, absolute source of truth.

This page explains how Jotter guarantees your data safety and how to perform backups and disaster recovery.

---

## Core Safety Principles

Jotter operates on three primary rules for your peace of mind:

1. **Human-Readable Storage**: Every single task card, checklist, tag, and deadline is saved as an individual `.md` file containing standard YAML frontmatter and Markdown body text.
2. **Local-First, Offline-First**: Jotter does not depend on cloud databases, remote servers, or internet connectivity to function. Your files stay on your hardware, under your full control.
3. **No Database Dependencies**: The database index (SQLite) is purely **ephemeral** (meaning temporary and throwaway). The database exists solely to make searching, filtering, and sorting fast. It does not own your data.

---

## Ephemeral Database Recovery

Since the SQLite database is just a performance cache, if the database file is ever corrupted, deleted, or falls out of sync, your data is 100% safe. 

### Re-indexing Your Workspace
If you notice that your board does not match the files on disk, or if you manually copied new markdown files into your `tasks` directory:
1. Open the sidebar in the Jotter application.
2. Click the **Sync** button at the bottom of the sidebar.
3. Jotter will instantly scan your task directories, clear the ephemeral cache, parse your markdown files, and reconstruct the SQLite index.

### Completely Rebuilding the Cache
If the application index becomes corrupted or if you want a completely fresh database state:
1. Close the Jotter application.
2. Locate the App Data directory on your computer:
   * **Linux**: `~/.config/jotter` or `~/.gemini/antigravity-cli` (or corresponding application path)
   * **macOS**: `~/Library/Application Support/jotter`
   * **Windows**: `%APPDATA%\jotter`
3. Delete the cache database file (typically named `index.db` or `cache.db`).
4. Start Jotter.
5. Click **Sync** in the sidebar. Jotter will reconstruct the entire database from your markdown files in a few seconds.

---

## Performing Backups

Backing up Jotter is as simple as backing up any folder on your computer. You don't need any complex database export scripts.

### Manual Backup
To create a complete backup of your boards and task details, simply copy your project folders to an external drive, USB stick, or cloud storage.
```bash
cp -r ~/Code/jotter/projects/my-board /media/backup/my-board-backup
```

### Automated Cloud Backups
Because your files are standard folder layouts, you can use any existing cloud synchronization or backup tools:
* **Dropbox / Google Drive / OneDrive**: Point Jotter to a project folder inside your synced cloud folder. As Jotter saves `.md` files, your cloud provider will automatically upload and version them.
* **Proton Drive / Syncthing**: Works beautifully with peer-to-peer or encrypted folder sync systems.

---

## Version History and Rollbacks

Because your files are stored in plain text, you can easily track history, view edits, and roll back mistakes using standard text-versioning systems.

### Git Version Control
If you configure Git synchronization, every single change you make inside Jotter is saved as a Git commit.
* **Roll back a deleted task**: If you accidentally delete a task card, you can easily restore it using your Git history:
  ```bash
  git checkout HEAD~1 -- tasks/accidental-deleted-task-id.md
  ```
* **Audit Trail**: You can run `git log -p tasks/task-id.md` in your terminal to see the complete history of edits, moves, and state changes for any task card over time.
