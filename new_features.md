# New Feature for Jotter

## Archiving tasks

- So far, there is a "Done" special column, that contains all tasks that were marked as done. Similarly, I want to have an option to mark tasks as "archived". Therefore, we need a "Archive" special column, that is very similar to the done column (hidden by default, option to toggle it on in the filtering-tasks settings). The archive column should _not_ have automatic cleaning of jobs, unlike the Done column.

## New Task properties and Views

- Reusable vue components across views: Please make sure we benefit from reusable components across the views. E.g.:
  - the TaskCard could be reused across the board, matrix and time view (with props for toggling to show more or less details).
  - Similarly, we could create a generic "TaskColumn" component that wraps a part of the KanbanColumn features (e.g. drag & drop, color tinting, header, grid options, options menu) and can be reused across board view and time view.
- let's separate the due date and the planning date. I can plan to do a task on a specific day but that should be separate from the "due" date of a task:
  - The planning date should not be exact, but a simple selection between: "no date", "today", "tomorrow", "this week", "this month", "this year", "sometime maybe", "not planned"
  - the time view should have columns corresponding exactly to the options of the planned date. Dragging from one column to another in the time view should set the planned date accordingly
  - If I quick enter a date via the "smart title keyword detection" that should set both the due date and the planning date.
- having the option to see a project-independent "super time view", that shows a time view for tasks of all projects (planned dates)
- The "List view" is not very helpful. I would like to ditch it and instead have a new "Spreadsheet view" that displays all tasks in a spreadsheet with columns like "Title, column, priority, due date, planned date, creation date". The spreadsheet columns should be sortable
- A "Tag View" that displays all tasks of a project in columns dictated by the tags they have. If a task has multiple tags, it may appear in multiple columns. Drag and drop should not be possible (too complex with having multiple tags)

## Bulk editing

- I want to be able to select (and multi-select) tasks in every view. If a TaskCard is being hovered a small subtle circular checkbox should appear at its top left corner that can be clicked to "check" it and thereby select the task. Multi-selection should be possible
- Ctrl+A hotkey for selecting all currently visible tasks
- Maybe even have the option to drag a rectangle for selection? All tasks within the rectange are being selected
- if tasks are selected, a snack bar should appear with bulk operations. I am thinking of the following bulk operations:
  - bulk move selected tasks to a column
  - bulk edit tags of tasks: small menu opens with tri-state-checkboxes for tags. Checkboxes for tags that no task has are empty, tags that every task has are checked, and tags which only some task have are in the third state.
  - bulk add planned date (see planned date feature above)
  - bulk move tasks to a project: the tasks are moved completely to a different project. Their columns stay the same, optionally adding new columns to that project (alternative: adding all to the default column of the project, you can decide which one is best).
- "Bulk drag and drop" should not be a thing, it increases complexity too much (I guess...?)

## File upload

- It should be possible to upload/attach files to a task (multiple files possible).
- Since this complicates the data model, at this point, we may switch to a package-by-feature layout in the backend (or package-by-aggregate with DDD aggregates)

## Other

- installer script for linux. On windows I can very easily "Add the .exe to Start" or "Pin to task bar", which feels like installing the tool. On linux, this is not possible. Please write an installer and uninstaller shell script that (un)registers the app in the applications of the current user (or as root, if run as root). It should be bundled with the linux release package in the CI pipeline.
