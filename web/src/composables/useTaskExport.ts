import { type Ref } from 'vue';
import type { Task } from '@/types';
import { useProjectStore } from '@/stores/project';
import { useI18n } from '@/composables/useI18n';

export function useTaskExport(filteredTasks: Ref<Task[]>, activeProjectId: Ref<string>) {
  const projectStore = useProjectStore();
  const { t } = useI18n();

  const exportTasks = async (format: 'xlsx' | 'csv') => {
    if (!filteredTasks.value || filteredTasks.value.length === 0) {
      alert(t('export.noTasks') || 'No tasks to export in the current view.');
      return;
    }

    const { utils, writeFile } = await import('xlsx');

    const exportData = filteredTasks.value.map((task) => {
      const bucket = projectStore.buckets.find((b) => b.name === task.bucket);
      const project = projectStore.projects.find((p) => p.id === task.project_id);
      return {
        'Task ID': task.id,
        Title: task.title,
        'Description / Notes': task.body || '',
        Column: bucket ? bucket.title : task.bucket,
        Priority: task.priority || 'none',
        Tags: task.tags ? task.tags.join(', ') : '',
        'Planned Date': task.planned_date || '',
        'Due Date': task.due_date || '',
        Project: project ? project.title : task.project_id || '',
        'Created At': task.created_at || '',
        'Updated At': task.updated_at || '',
      };
    });

    const worksheet = utils.json_to_sheet(exportData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Tasks');

    const activeProjectTitle = projectStore.projects.find((p) => p.id === activeProjectId.value)?.title || 'All Projects';
    const cleanTitle = activeProjectTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Jotter_Export_${cleanTitle}_${dateStr}.${format}`;

    writeFile(workbook, filename, { bookType: format });
  };

  return {
    exportTasks,
  };
}
