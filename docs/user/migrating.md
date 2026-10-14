# Moving Tasks In and Out

Jotter has no import or export wizard. Your vault is a folder of Markdown files, so there is nothing to convert on the way out, and for the way in you have two options.

## Getting your tasks out

Copy the vault folder, or open it in any editor or in Obsidian. Every task is one `.md` file with a small header (see the [file format](./format-spec.md)). If you need a table, a script that reads the headers of the files is a few lines in any language. If your vault is a Git repository, its history is the backup.

## Bringing tasks in from another tool

### With an AI assistant (MCP)

Connect an assistant through the [MCP server](../developer/api.md#model-context-protocol-mcp-integration) (`jotter mcp`), give it the export of the other tool (an Excel or CSV file from Microsoft Planner, a JSON export from Trello, a text list, a screenshot), and ask it to bring the tasks over:

> Read `planner-export.xlsx` and create the tasks in the project "Renovation". Use one column per Planner bucket, set the priority and due dates, put the checklist items into the notes, and mark finished tasks as done.

The assistant uses `create_project`, `create_bucket` and `batch_create_tasks` (title, column, tags, notes, priority, due date and planned date). It works with any source format, and it can clean up on the way: merge duplicates, translate column names, or drop old finished tasks. Look at the result on the board, then commit it (Jotter commits on its own if the vault is a Git repository).

### With a script

A script can write the task files directly, following the [file format](./format-spec.md): one `.md` file per task in the project's folder, with `status` (the column), `title` and the optional fields in the header. Jotter notices the new files at the next scan.
