import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rollOver } from "./recurrence";
import { parseTaskMarkdown } from "./markdownParser";
import type { Task } from "./types";

// Runs spec/fixtures/repeat/roll.json; the Python backend runs the same cases in tests/test_recurrence.py.
// Vitest runs from packages/vault-format
const spec = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../../spec/fixtures/repeat/roll.json"),
    "utf-8",
  ),
);

const taskOf = (fields: Record<string, any>): Task => {
  const parsed = parseTaskMarkdown(
    `---\ntitle: T\nrepeat: ${JSON.stringify(fields.repeat)}\n---\n`,
    "proj",
    "t.md",
  );
  return {
    ...parsed,
    bucket: fields.previous_bucket ?? "todo",
    body: fields.body ?? "",
    due_date: fields.due_date,
    planned_date: fields.planned_date,
    reminders: [...(fields.reminders ?? [])].sort(),
  };
};

describe("rolling a recurring task over", () => {
  for (const c of spec.cases) {
    it(c.name, () => {
      const rolled = rollOver(
        taskOf(c.task),
        c.today,
        spec.default_bucket,
        c.task.previous_bucket,
      );
      expect({
        bucket: rolled.bucket,
        due_date: rolled.due_date ?? null,
        planned_date: rolled.planned_date ?? null,
        reminders: rolled.reminders,
        body: rolled.body,
      }).toEqual(c.expected);
    });
  }

  it("leaves a task without a rule alone", () => {
    const task = parseTaskMarkdown(
      "---\ntitle: T\ndue_date: 2026-10-12\n---\n",
      "proj",
      "t.md",
    );
    expect(rollOver(task, "2026-10-12", "backlog")).toBe(task);
  });
});
