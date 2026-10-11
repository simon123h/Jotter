# The Android App

Jotter for Android reads and writes the same vault of Markdown files as the desktop app, with no server in between. Put the vault in a folder that your sync tool (Syncthing, Git, a cloud drive) shares with your computer, and both see the same tasks. See [Installation](/installation/precompiled) to get the app.

It covers the core: vaults, projects, columns, tasks with all their attributes, attachments, search and filters. Time blocking, the canvas and Git history stay on the desktop.

## Vaults and projects

On the first start the app asks for a folder to use as a vault, and for access to files. You can add more vaults and switch between them from the side menu.

- **Switching projects**: tap the project name in the top bar and pick one from the list, or use the side menu.
- **Pinning**: in *Manage projects* the pin button keeps a project at the top of every list. Pins are kept on the device, per vault.

## The board

Each column is a page: swipe sideways, or tap a tab, to change column. One swipe moves one column.

- **Add a task** with the round button. The sheet stays open, so you can capture several in a row.
- **Smart title**: dates (`tomorrow`, `fri`, `21.5.`), priorities (`p1` to `p4`), tags (`#home`) and columns (`/doing`) in the title are recognised and shown as chips above the field. Tap a chip's cross to keep the words as plain text, or press Backspace right after one to take it back.
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
| More | Mark done, archive, move to another project, due date, postpone, colour, delete |

To move a single card to a place in a column, press, hold and drag it.

## Views

The bar at the bottom switches the view. The columns are always tabs you can swipe.

- **Board**: one tab per column.
- **Tags**: one tab per tag, and one for tasks without a tag.
- **Planning**: one tab per planned date (today, tomorrow, this week, ...), and one for tasks without one.

Adding a task in a tab files it there: with that tag or that planned date.

## Search and filters

The search field understands the same query language as the desktop, for example `tag:work+urgent prio:high due:none bucket:todo`. The filter button next to it has selectors for priority, tag and due date, which write into the field and follow what you type. See [Search & Filtering](/user/searching-filtering) for the whole syntax. Words match the beginning of words in the title, notes and tags, so `sat` finds *saturation* as you type.

## Hiding done, archived and postponed tasks

The ⋮ menu in the top bar hides or shows done, archived and postponed tasks, separately for each view. On the board this also hides their columns. Tags and Planning start with all three hidden.

## Postponing

A task postponed to a later day leaves its column and appears in a *Postponed* column, which is hidden until you switch it on in the ⋮ menu. From the selection toolbar, *More*, *Postpone* offers *Tomorrow*, *Next week*, a date, or to clear it. The task page has a *Postponed until* field. Moving a task out of the Postponed column brings it back. See [Postponing Tasks](/user/postponing).

## Settings

Theme (including *True Black* for OLED screens, or follow the system), language and the vaults are in the side menu. Long-pressing the app icon offers shortcuts for a new task, the search and the planning view.

## Keeping in sync

The app rescans the vault periodically and when you return to it, so changes from your sync tool appear by themselves. *Rescan vault* in the side menu does it right away. The app keeps what it does not understand: unknown properties and files are never removed.
