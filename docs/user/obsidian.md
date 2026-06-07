# Obsidian and PKM Integration

Because Jotter stores your projects and boards as folders containing plain Markdown files, it integrates beautifully with Personal Knowledge Management (PKM) tools such as Obsidian, Logseq, Foam, or SilverBullet. 

You can point Jotter directly to your notes vault (or a sub-folder within it) to view, organize, and manage task cards side-by-side with your journals, personal wikis, and reference notes.

---

## Setting Up Jotter within an Obsidian Vault

Since Obsidian vaults are simply local directories containing folders of `.md` files, integrating Jotter is incredibly simple.

### Pointing Jotter to Your Vault
1. Locate your Obsidian vault directory on your computer's local storage (e.g., `~/Documents/MyVault`).
2. Inside your vault, create a dedicated folder for your Jotter tasks (e.g., `~/Documents/MyVault/projects/jotter-board`).
3. Open Jotter, create a new project (or edit your existing project), and set its project path to that folder.
4. Jotter will write its task `.md` files directly inside your vault.

Within seconds, you will see a `tasks` directory appear inside your Obsidian vault folder. All your Jotter task cards will show up inside Obsidian as normal markdown notes!

---

## Frontmatter Compatibility

Obsidian natively parses and indexes YAML frontmatter at the top of notes. This allows you to view and filter Jotter tasks directly inside your Obsidian environment using Obsidian core features or popular plugins.

### Obsidian Properties View
Obsidian's built-in **Properties** editor automatically detects the YAML frontmatter written by Jotter. You can view fields like `due_date`, `priority`, and `tags` as visual interactive widgets directly at the top of the note in Obsidian.

### Querying Tasks with Dataview
If you use the popular **Dataview** plugin in Obsidian, you can easily query and display your Jotter tasks across your second brain.

For example, to list all **high priority** Jotter tasks that are due before a certain date inside an Obsidian dashboard note, you can write:

```sql
TABLE due_date, priority, bucket
FROM "projects/jotter-board/tasks"
WHERE priority = "high" AND due_date <= date(today)
SORT due_date ASC
```

To list all tasks currently in your **In Progress** column:

```sql
LIST
FROM "projects/jotter-board/tasks"
WHERE bucket = "in-progress"
```

---

## Interlinking Tasks and Notes

Because Jotter task cards are plain Markdown files in your vault, you can interlink them with your existing knowledge base using standard Markdown link syntax.

### Referencing Notes from Jotter
In the markdown description block of your task card in Jotter, you can link directly to other files in your Obsidian vault. For instance, if you have a daily journal note or project specification in your vault, you can link to it:

```markdown
### Implementation Specification
Please refer to the technical specs in [Project Specification](../../engineering/spec.md) before starting this task.
```

When you view the card details inside the Jotter UI, clicking the link will open it in your system's default markdown handler (or relative path handler).

### Embedding Task Cards in Daily Notes
In your Obsidian daily notes, you can embed or link to the corresponding Jotter tasks for that day so that you can see exactly what was completed:

```markdown
## Completed Today
- [[projects/jotter-board/tasks/01HJKM7ST89AB234CDEFGHJKMN|Implemented Sidebar Link]]
- Finished reviewing documentation pull requests.
```

---

## Best Practices and Safe Co-existence

While Jotter is designed to be highly resilient, keeping these tips in mind ensures a seamless experience when both systems are active:

* **Keep Frontmatter Intact**: If you edit a task file inside Obsidian, make sure you don't delete critical Jotter YAML keys (such as `id`, `project_id`, `bucket`, or `position`). Doing so can cause Jotter to re-index the file or place it in a default column.
* **Normalize Tags**: Jotter normalizes tag arrays to lowercase to ensure consistency across kanban filters. In Obsidian, keep your tags lowercase to ensure they match identically between both systems.
* **Avoid Filename Collisions**: Jotter names files based on task IDs or parameterized slug names to prevent collision. We recommend allowing Jotter to handle file creation and deletions, while utilizing Obsidian for reading and content editing.
