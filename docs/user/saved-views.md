# Saved Views

A **view** is a search you keep under a name. It sits in the sidebar, above the projects, and opens the result with one click. Views belong to the vault, not to a project, so they follow it to every device: the desktop app and the phone read the same list.

## Saving a search

1. Type a search into the search field, for example `planned:after:today sort:planned` (see [Searching & Filtering](./searching-filtering)).
2. Click the bookmark in the search field and give the view a name.

A search saved from inside a project gets `project:<name>` added, so the view keeps showing that project. Save it from _All Projects_ (or write a query without `project:`) for a view across all of them.

Click a view in the sidebar to open it. It shows the tasks of all projects that match, in the **list**, in the order the search asks for (`sort:`). The **...** button on the row changes its name or its search, or deletes it.

## The example views

A vault starts with two views, which you can change or delete like your own:

| View               | Search                                                                                  |
| :----------------- | :-------------------------------------------------------------------------------------- |
| **Upcoming**       | `planned:after:today sort:planned`: everything planned from today on, the nearest first |
| **Recently added** | `created:after:-7d sort:-created`: what was added in the last week, the newest first    |

They are offered once. When you delete them, they stay deleted.

## Good to know

- A search that names `planned:` (`planned:after:...`) ignores the [planning horizon](./planning), as any search with a planned date does. Other searches keep it.
- Done and archived tasks stay out of a view, unless its search names their column (`bucket:done`).
- A renamed tag or project is not followed: the view's search keeps the old name.
- The views are stored as `views` in the vault's `settings.json`: a name and a query each.
