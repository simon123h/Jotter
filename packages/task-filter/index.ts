/**
 * The task search of Jotter: the query language of the search field, and the matching of tasks against it.
 *
 *   tag:ui+bug prio:high due:before:2026-12-31 "fix leak"
 *
 * `parseQuery` turns a query into a `TaskFilter`, `stringifyQuery` goes back, and `filterTasks` keeps the tasks that
 * match. The Python backend answers the same filters from its SQLite index; the fixtures in spec/fixtures/search are
 * run against both, so that they agree.
 */

/** What a query asks for. Lists are comma-separated strings, as the HTTP API takes them. */
export interface TaskFilter {
  bucket?: string;
  buckets?: string;
  tag?: string;
  tags?: string;
  tag_mode?: "any" | "all";
  exclude_bucket?: string;
  exclude_buckets?: string;
  /** low, medium, high, urgent, or none for tasks without a priority. */
  priorities?: string;
  search?: string;
  due_before?: string; // YYYY-MM-DD
  due_after?: string;
  planned_date?: string;
  has_due_date?: boolean | null;
  created_before?: string;
  created_after?: string;
  updated_before?: string;
  updated_after?: string;
  /** A project id or title. Matching one task cannot tell: the caller narrows the tasks to it. */
  project?: string;
}

/** The parts of a task that a filter looks at. */
export interface FilterableTask {
  title: string;
  body?: string | null;
  bucket: string;
  tags: string[];
  priority?: string | null;
  due_date?: string | null;
  planned_date?: string | null;
  postponed_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ---------- tags ----------

/**
 * The tags in a text or a list: tags are separated by commas, semicolons, bars, line breaks or spaces (a tag has no space,
 * spec/FORMAT.md). They lose a leading #, are lower-cased, and each one appears once, in the order it came.
 */
export function parseTags(input: string | readonly string[] | null | undefined): string[] {
  if (!input) return [];
  const parts = typeof input === "string" ? [input] : input;
  const tags = parts
    .flatMap((part) => String(part).split(/[,;|\s]+/))
    .map((tag) => tag.replace(/^#+/, "").toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

// ---------- the query language ----------

const quoted = (value: string) => (value.includes(" ") ? `"${value}"` : value);

/**
 * Supports:
 * - tag:ui,bug (any of them) or tag:ui+bug (all of them), also `tags:`
 * - #ui for a tag; several (#ui #bug) need all of them. Only a token that starts with # counts, so issue#12 stays a word
 * - bucket:todo or buckets:todo,review
 * - priority:high or prio:high,urgent (`none` for tasks without one)
 * - project:work or proj:work
 * - planned:today
 * - due:has, due:none, due:before:YYYY-MM-DD, due:after:YYYY-MM-DD; created: and updated: take before: and after:
 * - words and "quoted phrases" for the full-text search
 * Values with spaces go in quotes (bucket:"in progress").
 */
export function parseQuery(query: string): TaskFilter {
  const filter: TaskFilter = {};
  const searchTerms: string[] = [];

  // key:"quoted value", key:value, #tag, "quoted text" or a plain word
  const regex =
    /(-?\w+):(?:"([^"]+)"|([^\s]+))|#([^\s]+)|(?:"([^"]+)"|([^\s]+))/g;
  let match;
  let afterHashTag = false;

  while ((match = regex.exec(query)) !== null) {
    const [, key, quotedVal, unquotedVal, hashTag, quotedText, unquotedText] =
      match;

    if (hashTag) {
      // the tags of a run of #tokens add up; a tag: token before it is replaced
      const previous = afterHashTag && filter.tags ? `${filter.tags},` : "";
      filter.tags = previous + hashTag;
      filter.tag_mode = previous ? "all" : "any";
      afterHashTag = true;
      continue;
    }
    afterHashTag = false;

    if (key) {
      const rawValue = (
        quotedVal !== undefined ? quotedVal : unquotedVal || ""
      ).trim();
      const lowerKey = key.toLowerCase();

      if (lowerKey === "tag" || lowerKey === "tags") {
        const all = rawValue.includes("+");
        filter.tags = rawValue
          .split(all ? "+" : ",")
          .map((t) => t.trim())
          .filter(Boolean)
          .join(",");
        filter.tag_mode = all ? "all" : "any";
      } else if (lowerKey === "bucket" || lowerKey === "buckets") {
        filter.buckets = rawValue;
      } else if (
        lowerKey === "priority" ||
        lowerKey === "priorities" ||
        lowerKey === "prio"
      ) {
        filter.priorities = rawValue;
      } else if (lowerKey === "project" || lowerKey === "proj") {
        filter.project = rawValue;
      } else if (lowerKey === "planned") {
        filter.planned_date = rawValue;
      } else if (lowerKey === "due") {
        const lowerVal = rawValue.toLowerCase();
        if (lowerVal === "has") filter.has_due_date = true;
        else if (lowerVal === "none") filter.has_due_date = false;
        else if (rawValue.startsWith("before:"))
          filter.due_before = rawValue.substring(7);
        else if (rawValue.startsWith("after:"))
          filter.due_after = rawValue.substring(6);
      } else if (lowerKey === "created") {
        if (rawValue.startsWith("before:"))
          filter.created_before = rawValue.substring(7);
        else if (rawValue.startsWith("after:"))
          filter.created_after = rawValue.substring(6);
      } else if (lowerKey === "updated") {
        if (rawValue.startsWith("before:"))
          filter.updated_before = rawValue.substring(7);
        else if (rawValue.startsWith("after:"))
          filter.updated_after = rawValue.substring(6);
      }
    } else {
      const text = (
        quotedText !== undefined ? quotedText : unquotedText || ""
      ).trim();
      if (text) searchTerms.push(text);
    }
  }

  if (searchTerms.length > 0) filter.search = searchTerms.join(" ");
  return filter;
}

/** The query that parses back to the same filter. */
export function stringifyQuery(filter: TaskFilter): string {
  const parts: string[] = [];

  if (filter.buckets)
    parts.push(
      `${filter.buckets.includes(",") ? "buckets" : "bucket"}:${quoted(filter.buckets)}`,
    );
  if (filter.priorities) parts.push(`priority:${quoted(filter.priorities)}`);
  if (filter.project) parts.push(`project:${quoted(filter.project)}`);
  if (filter.tags)
    parts.push(
      `tags:${quoted(filter.tags.split(",").join(filter.tag_mode === "all" ? "+" : ","))}`,
    );
  if (filter.planned_date) parts.push(`planned:${quoted(filter.planned_date)}`);
  if (filter.has_due_date !== undefined && filter.has_due_date !== null)
    parts.push(`due:${filter.has_due_date ? "has" : "none"}`);
  if (filter.due_before) parts.push(`due:before:${filter.due_before}`);
  if (filter.due_after) parts.push(`due:after:${filter.due_after}`);
  if (filter.created_before)
    parts.push(`created:before:${filter.created_before}`);
  if (filter.created_after) parts.push(`created:after:${filter.created_after}`);
  if (filter.updated_before)
    parts.push(`updated:before:${filter.updated_before}`);
  if (filter.updated_after) parts.push(`updated:after:${filter.updated_after}`);
  if (filter.search) parts.push(filter.search);

  return parts.join(" ");
}

/** Whether the query asks for anything: a filter of only empty fields does not. */
export function isEmptyFilter(filter: TaskFilter): boolean {
  return !Object.entries(filter).some(([key, value]) =>
    key === "tag_mode"
      ? false
      : value !== undefined && value !== null && value !== "",
  );
}

// ---------- matching ----------

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

/** A day as YYYY-MM-DD in the local calendar, `offset` days from today. */
export function isoDay(offset = 0, now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Today as YYYY-MM-DD in the local calendar. */
export function today(now: Date = new Date()): string {
  return isoDay(0, now);
}

/** Postponed to a day after today: the task is out of the way until then. */
export const isPostponed = (
  task: { postponed_until?: string | null },
  now: Date = new Date(),
) => !!task.postponed_until && task.postponed_until > today(now);

/** The words of a text, lower case: letters and digits, the rest separates. */
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** A date alone covers its whole day when compared with a timestamp. */
const endOfDay = (date: string) =>
  date.length === 10 ? `${date}T23:59:59.999999` : date;
const startOfDay = (date: string) =>
  date.length === 10 ? `${date}T00:00:00` : date;

/**
 * Whether a task matches. `today` decides which postponements are still running. A postponed task stays in its own
 * column (spec/FORMAT.md): a bucket finds it there, and the pseudo bucket `postponed` finds the ones that are postponed
 * to a later day, whichever column they are in.
 */
export function matchesFilter(
  task: FilterableTask,
  filter: TaskFilter,
  day: string = today(),
): boolean {
  const postponedNow = !!task.postponed_until && task.postponed_until > day;
  const bucket = task.bucket.toLowerCase();

  const buckets = list(filter.buckets);
  if (filter.bucket) {
    if (filter.bucket.toLowerCase() === "postponed") {
      if (!postponedNow) return false;
    } else if (bucket !== filter.bucket.toLowerCase()) return false;
  } else if (buckets.length) {
    const inRegular = buckets.includes(bucket) && bucket !== "postponed";
    const inPostponed = buckets.includes("postponed") && postponedNow;
    if (!inRegular && !inPostponed) return false;
  } else if (
    (filter.exclude_bucket?.toLowerCase() === "postponed" ||
      list(filter.exclude_buckets).includes("postponed")) &&
    postponedNow
  ) {
    return false;
  }
  if (
    filter.exclude_bucket &&
    filter.exclude_bucket.toLowerCase() !== "postponed" &&
    bucket === filter.exclude_bucket.toLowerCase()
  )
    return false;
  if (
    list(filter.exclude_buckets).some((b) => b !== "postponed" && b === bucket)
  )
    return false;

  const wanted = filter.tags
    ? list(filter.tags)
    : filter.tag
      ? [filter.tag.toLowerCase()]
      : [];
  if (wanted.length) {
    const has = new Set(task.tags.map((t) => t.toLowerCase()));
    if (
      filter.tag_mode === "all"
        ? !wanted.every((t) => has.has(t))
        : !wanted.some((t) => has.has(t))
    )
      return false;
  }

  const priorities = list(filter.priorities);
  if (priorities.length) {
    const own = (task.priority ?? "").toLowerCase();
    if (!(own ? priorities.includes(own) : priorities.includes("none")))
      return false;
  }

  const due = task.due_date || "";
  if (filter.has_due_date === true && !due) return false;
  if (filter.has_due_date === false && due) return false;
  if (filter.due_before && !(due && due <= filter.due_before)) return false;
  if (filter.due_after && !(due && due >= filter.due_after)) return false;
  if (filter.planned_date && task.planned_date !== filter.planned_date)
    return false;

  const created = task.created_at ?? "";
  const updated = task.updated_at ?? "";
  if (filter.created_before && !(created <= endOfDay(filter.created_before)))
    return false;
  if (filter.created_after && !(created >= startOfDay(filter.created_after)))
    return false;
  if (filter.updated_before && !(updated <= endOfDay(filter.updated_before)))
    return false;
  if (filter.updated_after && !(updated >= startOfDay(filter.updated_after)))
    return false;

  if (filter.search) {
    const terms = words(filter.search);
    if (terms.length) {
      const text = words(
        `${task.title} ${task.body ?? ""} ${task.tags.join(" ")}`,
      );
      // Every word typed starts some word of the task, so "sat" finds "saturation" while it is being typed
      if (!terms.every((term) => text.some((word) => word.startsWith(term))))
        return false;
    }
  }
  return true;
}

/** The tasks that match, in their order. */
export function filterTasks<T extends FilterableTask>(
  tasks: T[],
  filter: TaskFilter,
  day: string = today(),
): T[] {
  return isEmptyFilter(filter)
    ? tasks
    : tasks.filter((task) => matchesFilter(task, filter, day));
}

/** A title without its emojis, for a window or tab title, where they are noise. */
export function withoutEmoji(title: string): string {
  return title
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** How titles sort: emojis, symbols and punctuation in front of a title do not count, case and accents hardly. */
export function compareTitles(a: string, b: string): number {
  const key = (title: string) => title.replace(/^[^\p{L}\p{N}]+/u, "");
  return (
    key(a).localeCompare(key(b), undefined, { sensitivity: "base" }) ||
    a.localeCompare(b)
  );
}
