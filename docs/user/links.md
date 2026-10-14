# Links and Bookmarks

A task whose title or notes hold a web address is a bookmark. Nothing special is stored: the address is plain text, so
the file stays readable everywhere. Use a project such as *Links*, columns such as *Inbox*, *To read* and *Done*, and
tags for topics, and the search, the reminders and the Git history work for your bookmarks like for any task.

## The link on the card

The first web address in the title, or else in the notes, shows on the card as its domain (`example.com`). Tapping it
opens the page in the browser, without opening the task.

## Already saved

When the address you add is already in the project, the dialog says *Already saved: …* and names the task. It does not stop
you: addresses count as the same page without `www.`, a `#fragment`, a trailing `/` or tracking parameters such as
`utm_source`. The desktop looks at the tasks that are loaded on the board.

## Titles of links (optional)

When you add a task that is **only** a web address (pasted, or shared from another app), Jotter can read the page's title and
use it as the task's title, with the address moved into the notes. This is **off by default**, because it contacts the website:
the address is sent to it, nothing else.

- **Desktop**: *Settings → Look up the titles of links*. The Jotter server loads the page, so it needs to reach the internet. It only
  fetches `http` and `https` addresses, never a host on your own machine or network, gives up after six seconds, and reads at
  most half a megabyte.
- **Android**: *Settings → Look up the titles of links*. The phone loads the page.

If the page cannot be read in time, or has no title, nothing changes: the task keeps the address as its title. A title you type
yourself while the look-up runs is never replaced.
