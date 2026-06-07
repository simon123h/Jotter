# Git Synchronization and Collaboration

Jotter is built to support robust background Git integration. Connecting your projects to a Git remote repo (such as GitHub, GitLab, Gitea, or self-hosted Git servers) enables automatic synchronization, backing up your boards and keeping tasks synchronized across multiple computers.

This page guides you through setting up Git synchronization, authenticating, and working collaboratively using plain text files.

---

## How Git Synchronization Works

When Git integration is enabled, Jotter acts as an automated version control companion:

* **Automatic Index Rebuilds**: Whenever Jotter triggers a sync (either manually by clicking the **Sync** button or automatically in the background), it executes a series of Git actions on your behalf.
* **Intelligent Commits**: Jotter detects modifications, additions, and deletions of markdown task files, stages them, and commits them automatically with clean, descriptive conventional commit messages.
* **Upstream Sync**: It performs a background `git pull --rebase` to pull down changes made on other machines, integrates them seamlessly, and then executes a `git push` to upload your local updates to the remote repository.

---

## Configuring a Git Remote

You can configure Git integration globally for your entire workspace or individually on a project-by-project basis.

### Setting Up Individual Project Sync
1. Open the sidebar, find your project, and click the **Edit** (pencil) button.
2. In the **Git Remote URL** field, enter your repository's URL. For example:
   * **SSH**: `git@github.com:username/my-jotter-tasks.git` (Recommended)
   * **HTTPS**: `https://github.com/username/my-jotter-tasks.git`
3. Click **Save**.

### Setting Up Global Workspace Sync
If you keep all of your projects and task subdirectories inside a single central directory, you can configure a global Git repository:
1. Navigate to **Settings** from the sidebar.
2. Under **Git Synchronization**, enter the global remote repository URL.
3. Once saved, Jotter will manage synchronization across your entire workspace directory.

---

## Authentication and Security

Jotter uses your local system's Git installation to perform pull, push, and commit actions. This means it inherits your system's existing security, keys, and configurations.

### Using SSH (Recommended)
We highly recommend using SSH URLs (`git@github.com:...`).
* If your local SSH keys are registered with your SSH agent and added to your GitHub/GitLab account, Jotter will authenticate automatically in the background without needing any password prompts.
* Make sure your SSH key is added using `ssh-add` in your terminal prior to starting Jotter so the background process has access to it.

### Using HTTPS and Personal Access Tokens
If you prefer HTTPS URLs (`https://github.com/...`):
* Configure Git's local **credential helper** so your credentials are cached. You can enable this by running:
  ```bash
  git config --global credential.helper store
  ```
* When pushing or pulling for the first time, your system will ask for your username and password. Use a **Personal Access Token (PAT)** instead of your account password (GitHub/GitLab require PATs for security). Once stored, Jotter will sync silently in the background.

---

## Multi-Device and Team Collaboration

Because Git handles merge conflicts beautifully for plain text files, multiple people (or you, using multiple devices) can work on the same task directory at the same time.

### Normal Flow
When you open Jotter on a machine, click the **Sync** button. It will pull the latest changes, sync them into your local SQLite index, and render the updated board. As you move cards around or edit tasks, Jotter creates local commits and pushes them upstream so they are immediately available to your other devices.

### Handling Merge Conflicts
In rare instances, if the exact same line of the same task `.md` file is modified on two different computers simultaneously, a Git merge conflict can occur.
* **How Jotter Responds**: Because Jotter runs a `git pull --rebase` in the background, a merge conflict will temporarily halt background pushing to protect your data.
* **Resolution**: 
  1. Open a terminal and navigate to your project directory.
  2. Run `git status` to see which files are in conflict.
  3. Open the conflicted task files in your text editor. Standard Git conflict markers (`<<<<<<< HEAD` and `>>>>>>>`) will clearly show you the differences.
  4. Edit the files to resolve the conflict, save them, and run:
     ```bash
     git add tasks/conflicted-task.md
     git rebase --continue
     ```
  5. Once the rebase is finished, your local index is clean, and clicking **Sync** in Jotter will resume automatic syncing.
