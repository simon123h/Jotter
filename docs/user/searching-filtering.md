# Task Searching & Filtering DSL

Jotter features a robust, keyboard-centric Search Domain-Specific Language (DSL) directly inside the navigation search bar. This allows power-users to filter tasks across boards, lists, and timelines with speed and precision, using query keywords similar to GitHub, Jira, or Linear.

## Bidirectional Synchronization

One of the most powerful features of Jotter's search is **Bidirectional Synchronization**:
* **Typing Queries**: As you type criteria into the search box, the corresponding checkboxes and inputs in the **Filter Modal** are automatically updated in real-time.
* **Using the Modal**: If you open the Filter Modal visually and check a tag or priority, Jotter instantly generates and appends the correct DSL query inside the search input. This serves as an interactive guide to help you learn the query syntax.

---

## Query Syntax Reference

A search query is composed of standalone full-text search phrases and optional colon-separated criteria (`field:value`). Standalone words are evaluated as full-text terms against task titles and bodies.

| Filter Criterion | Query Example | Description |
| :--- | :--- | :--- |
| **Full-text search** | `auth login` | Tasks containing both "auth" and "login" in title or description |
| **Quoted Phrase** | `"fix memory leak"` | Tasks containing the exact phrase "fix memory leak" |
| **Tag (OR Match)** | `tags:ui,bug` <br> *or* `tag:ui,bug` | Tasks with **either** the `ui` tag **or** the `bug` tag |
| **Tag (AND Match)** | `tags:ui+bug` <br> *or* `tag:ui+bug` | Tasks that must have **both** the `ui` tag **and** the `bug` tag |
| **Columns/Buckets** | `bucket:todo` <br> *or* `buckets:todo,progress` | Tasks residing in the specified bucket(s) |
| **Priorities** | `priority:high` <br> *or* `prio:high,urgent` | Tasks with the specified priority levels |
| **Projects** | `project:marketing` <br> *or* `proj:frontend` | Tasks belonging to a project by ID or **Project Title** |
| **Presence of Due Date** | `due:has` <br> *or* `due:none` | Tasks that have *any* due date, or *no* due date |
| **Due Date Boundaries** | `due:before:2026-12-31` <br> `due:after:2026-06-01` | Tasks with due dates within the specified date boundaries |

---

## Combining Queries

All separate field criteria in your query are combined using logical `AND`. Commas `,` within field values represent logical `OR`.

### Examples:

1. **High priority bugs in the todo column:**
   ```text
   tag:bug priority:high bucket:todo
   ```
   *Filters for tasks that are tagged `bug` **AND** have `high` priority **AND** are currently in the `todo` bucket.*

2. **UI or UX tasks due before mid-December:**
   ```text
   tags:ui,ux due:before:2026-12-15
   ```
   *Filters for tasks tagged `ui` **OR** `ux` **AND** having a due date earlier than December 15th, 2026.*

3. **Database tasks in the frontend project with no due date:**
   ```text
   project:frontend due:none database
   ```
   *Filters for tasks belonging to the project "frontend" (by title or ID) **AND** having no due date **AND** containing the word "database" in their title or description.*

4. **Critical frontend UI bugs:**
   ```text
   proj:frontend tags:ui+bug prio:high,urgent
   ```
   *Filters for tasks belonging to the project "frontend" **AND** containing BOTH the `ui` and `bug` tags **AND** having either a `high` or `urgent` priority.*
