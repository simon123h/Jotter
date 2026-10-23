# The Android App

Jotter for Android reads and writes the same vault of Markdown files as the desktop app, with no server in between. Put the vault in a folder that your sync tool (Syncthing, Git, a cloud drive) shares with your computer, and both see the same tasks. See [Installation](/installation/precompiled) to get the app.

It covers the core: vaults, projects, columns, tasks with all their attributes, attachments, search and filters. Time blocking, the canvas and Git history stay on the desktop.

## Vaults and projects

On the first start the app asks for a folder to use as a vault, and for access to files. You can add more vaults and switch between them from the side menu.

- **Switching projects**: tap the project name in the top bar and pick one from the list, or use the side menu.
- **Archiving**: in *Manage projects* the archive button puts a project away (with an Undo). It leaves the lists, and its reminders stop. *Archived* at the bottom of the list brings it back or deletes it. The tasks stay as they are.
- **Pinning**: in *Manage projects* the pin button keeps a project at the top of every list. Pins are kept on the device, per vault.

## The board

Each column is a page: swipe sideways, or tap a tab, to change column. One swipe moves one column.

- **Add a task** with the round button. The sheet stays open, so you can capture several in a row.
- **Smart title**: dates (`tomorrow`, `fri`, `21.5.`), priorities (`p1` to `p4`), tags (`#home`) and columns (`/doing`) in the title are recognised and shown as chips above the field. A date plans the task; put `!` in front of it (`!21.5.`) or the word `until` (`until friday`) and it is a deadline instead. Tap a chip's cross to keep the words as plain text, or press Backspace right after one to take it back.
- **Finish a task** with the circle in front of it. A tap on the circle of a finished task reopens it. Every change offers *Undo*.
- **Open a task** by tapping it. The task page is full screen: title, notes, checklist, column, priority, dates, tags, colour and attachments. Everything is saved as you type; the menu at the top holds *Mark done*, *Archive* and *Delete*.

## Selecting several tasks

Press and hold a task to select it, then tap more tasks. The bar at the top shows the count and a button to select the whole column. The toolbar at the bottom acts on the selection:

| Button | Does |
| :-- | :-- |
| Move | Moves the tasks to a column |
| Tag | Adds or removes tags |
| Priority | Sets the priority |
| Planned | Sets the planned date |
| More | Mark done, archive, move to another project, due date, colour, delete |

To move tasks without the sheet, leave them selected and open another column: the bar at the top then has a *Move here* button that puts the selected tasks at the end of the column you are looking at. In the list view every section header has the same button while tasks are selected, also on a folded one. The planning view works the same way: *Move here* plans the tasks for the stretch of time you are looking at (*Not planned* clears the date; *Re-plan* has no button). In the tag view a task can be in several columns, so there is no move: the bar offers *Add #tag* and *Remove #tag* for the column in view, and *Remove tags* in *Untagged*. To move a single card to a place in its column, press, hold and drag it.

## Views

The bar at the bottom switches the view. The columns are tabs you can swipe, or, with *Show as list* in the ⋮ menu, one list with a section for each column. A section folds away when you tap its header; empty ones show only the header, and *Done* and *Archive* start folded.

- **Board**: one tab per column.
- **Tags**: one tab per tag, and one for tasks without a tag.
- **Planning**: a first tab for tasks that are not planned, a *Re-plan* tab while something has slipped, and one tab for each stretch of time ahead (today, tomorrow, the rest of this week, next week, the rest of this month, later).

Adding a task in a tab files it there: with that tag or that planned date.

## Search and filters

The search field understands the same query language as the desktop, for example `tag:work+urgent prio:high due:none bucket:todo`. The filter button next to it has selectors for priority, tag and due date, which write into the field and follow what you type. See [Search & Filtering](/user/searching-filtering) for the whole syntax. Words match the beginning of words in the title, notes and tags, so `sat` finds *saturation* as you type.

## Hiding done and archived tasks, and planning ahead

The ⋮ menu in the top bar hides or shows done and archived tasks, separately for each view. On the board, hiding done or archived tasks hides their columns too. Tags and Planning start with both hidden.

*Show planned tasks…* in the same menu sets how far ahead the view shows planned tasks: today, tomorrow, the end of this week, the end of this month, or no limit. A task planned beyond that stays in its column but is hidden until it comes within reach, and the menu says how many are out of the way. It applies to the board and the tags together (*Today* until you change it) and is stored in the vault, so it is the same value as the setting on the desktop. The planning view looks ahead by nature and has no horizon. See [Planning Tasks](/user/planning).

## Settings

Theme (including *True Black* for OLED screens, or follow the system, with a light and a dark theme of your choice), language and the vaults are in the side menu. Long-pressing the app icon offers shortcuts for a new task, the search and the planning view. The new task from the shortcut, like shared text, goes to the default column of the project you chose under *Settings → Project for quick capture*, or, if you chose none, of the project you were last in. The chip above the field says where, and tapping it lets you pick another project or column. The choice is saved in the vault, so the desktop app uses it too (see [Shortcuts](/user/shortcuts)).

To save something from another app (a web page, a message), use its *Share* button and choose Jotter. Quick add opens with the shared text: the title the other app sends with it (usually the page's title) or the first line becomes the task's title, the rest its notes. A line like `Headline – https://…` gives the headline as the title and the address as the notes. Tags, dates and priority in the text are recognised as usual.

## Keeping in sync

The app rescans the vault periodically and when you return to it, so changes from your sync tool appear by themselves. *Rescan the open vault* in the vault list (tap the vault in the side menu) does it right away. The app keeps what it does not understand: unknown properties and files are never removed.
