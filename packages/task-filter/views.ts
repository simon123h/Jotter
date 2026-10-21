/**
 * Saved views: a name and a query of the search language. They are kept in the settings of the vault (`views` in
 * settings.json), so the desktop app and the phone share them.
 */

import { parseQuery, stringifyQuery } from "./index";

export interface SavedView {
  id: string;
  name: string;
  query: string;
}

/** The views a vault starts with, until the user has a list of their own. The names come from the app, in its language. */
export function exampleViews(names: { upcoming: string; recent: string }): SavedView[] {
  return [
    { id: "upcoming", name: names.upcoming, query: "planned:after:today sort:planned group:planned" },
    { id: "recent", name: names.recent, query: "created:after:-7d sort:-created" },
  ];
}

/** An id for a new view: the name as a slug, with a number when another view has it. */
export function newViewId(name: string, existing: readonly SavedView[]): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "view";
  const taken = new Set(existing.map((view) => view.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** The query as the language reads it: two spellings of the same search are the same. */
export const normalizedQuery = (query: string) => stringifyQuery(parseQuery(query));

/** Whether two queries ask for the same. */
export const sameQuery = (a: string, b: string) => normalizedQuery(a) === normalizedQuery(b);

/**
 * A search saved from inside a project asks for that project, or the view would show every project's tasks. A query
 * that names a project already keeps it.
 */
export function scopedQuery(query: string, projectId: string | null | undefined): string {
  const text = query.trim();
  if (!projectId || projectId === "all" || parseQuery(text).project) return text;
  return `project:${/\s/.test(projectId) ? `"${projectId}"` : projectId}${text ? ` ${text}` : ""}`;
}
