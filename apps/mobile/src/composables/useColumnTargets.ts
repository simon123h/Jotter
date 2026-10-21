import { plannedSlot } from '@jotter/task-filter';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import type { Column } from '@/stores/columns';
import { useTaskActions } from '@/composables/useTaskActions';

/** A button that puts the selected tasks into a column, or takes them out of it. */
export interface ColumnTarget {
  id: 'move-here' | 'tag-add' | 'tag-remove';
  label: string;
  run: () => void;
}

/**
 * What the selected tasks can do with a column: the board and the planning view move them into it (a column of the board
 * sets the bucket, a stretch of time the planned date). A task is in every tag column of its tags, so the tag view has
 * no move: it adds the tag of the column, or takes it away; Untagged takes all tags away.
 */
export function useColumnTargets() {
  const app = useAppStore();
  const actions = useTaskActions();

  function targetsFor(col: Column): ColumnTarget[] {
    const ids = [...app.selection];
    const tasks = ids.flatMap((id) => app.taskById(id) ?? []);
    if (!tasks.length) return [];

    if (app.view === 'board') {
      if (!col.bucket || tasks.every((task) => task.bucket === col.bucket)) return [];
      return [{ id: 'move-here', label: t('move.here'), run: () => actions.moveTo(ids, col.bucket!) }];
    }

    if (app.view === 'planning') {
      // What has slipped is not a place to put a task: it would be planned for today
      if (col.key === 'planned:slipped') return [];
      const slot = col.key.slice('planned:'.length);
      if (tasks.every((task) => plannedSlot(task.planned_date) === slot)) return [];
      return [{ id: 'move-here', label: t('move.here'), run: () => settle(actions.setPlanned(ids, col.value ?? ''), ids) }];
    }

    const tag = col.value ?? '';
    if (!tag) {
      if (!tasks.some((task) => task.tags.length)) return [];
      return [{ id: 'tag-remove', label: t('move.removeTags'), run: () => settle(actions.clearTags(ids), ids) }];
    }
    const targets: ColumnTarget[] = [];
    if (tasks.some((task) => !task.tags.includes(tag))) {
      targets.push({ id: 'tag-add', label: t('move.addTag', { tag: col.title }), run: () => settle(actions.addTags(ids, [tag]), ids) });
    }
    if (tasks.some((task) => task.tags.includes(tag))) {
      targets.push({
        id: 'tag-remove',
        label: t('move.removeTag', { tag: col.title }),
        run: () => settle(actions.removeTag(ids, tag), ids),
      });
    }
    return targets;
  }

  /** Like a move on the board, a change of a field uses the selection up. */
  async function settle(done: Promise<void>, ids: string[]) {
    await done;
    app.deselect(ids);
  }

  return { targetsFor };
}
