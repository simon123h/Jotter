# Links and Bookmarks

A task whose title or notes hold a web address is a bookmark. Nothing special is stored: the address is plain text, so
the file stays readable everywhere. Use a project such as _Links_, columns such as _Inbox_, _To read_ and _Done_, and
tags for topics, and the search, the reminders and the Git history work for your bookmarks like for any task.

## The link on the card

The first web address in the title, or else in the notes, shows on the card as its domain (`example.com`). Tapping it
opens the page in the browser, without opening the task.

## Already saved

When the address you add is already in the project, the dialog says _Already saved: …_ and names the task. It does not stop
you: addresses count as the same page without `www.`, a `#fragment`, a trailing `/` or tracking parameters such as
`utm_source`. The desktop looks at the tasks that are loaded on the board.

## Titles of links (Android)

When you add a task that is **only** a web address, pasted or shared from another app (not typed letter by letter, which would contact every address on the way), the Android app reads the title
of the page and uses it as the task's title, with the address moved into the notes. The phone loads the page itself, so the
address is sent to that website, nothing else. Only `https` pages can be read. The desktop never looks anything up: it makes no requests of its own.

If the page cannot be read in time, or has no title, nothing changes: the task keeps the address as its title. A title you type
yourself while the look-up runs is never replaced.
