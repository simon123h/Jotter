import type { Project } from '@/types';
import { getProjects, createProject, updateProject, deleteProject } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { settingsStore } from '@/stores/settings';

export function useProjects(onSelectProject: (id: string) => void) {
  const { t } = useI18n();
  const { showDialog } = useDialog();

  let projectsVal = $state<Project[]>([]);
  let editingProjectVal = $state<Project | null>(null);
  let isProjectEditModalOpenVal = $state(false);
  let errorVal = $state<string | null>(null);

  const fetchProjects = async () => {
    try {
      projectsVal = await getProjects();
      if (!projectsVal.find((p) => p.id === settingsStore.activeProjectId)) {
        if (projectsVal.length > 0) {
          onSelectProject(projectsVal[0].id);
        } else {
          onSelectProject('default');
        }
      }
    } catch (err: any) {
      errorVal = err.message || 'Failed to fetch projects';
    }
  };

  const handleCreateProject = async (title: string) => {
    try {
      const created = await createProject(title);
      await fetchProjects();
      onSelectProject(created.id);
    } catch (err: any) {
      errorVal = err.message || 'Failed to create project';
    }
  };

  const handleEditProject = (project: Project) => {
    editingProjectVal = project;
    isProjectEditModalOpenVal = true;
  };

  const handleSaveProject = async ({ id, title, done_clean_period }: { id: string; title: string; done_clean_period: number | null }) => {
    try {
      await updateProject(id, { title, done_clean_period });
      await fetchProjects();
    } catch (err: any) {
      errorVal = err.message || 'Failed to update project';
    }
  };

  const handleDeleteProject = async (project: Project | null) => {
    if (!project) return;
    const confirmed = await showDialog({
      title: t('buttons.delete'),
      message: t('projects.deleteProjectConfirm', { title: project.title }),
      type: 'warning',
      showCancel: true,
      confirmText: t('buttons.delete'),
      cancelText: t('buttons.cancel'),
    });
    if (!confirmed) return;

    try {
      await deleteProject(project.id);
      isProjectEditModalOpenVal = false;
      await fetchProjects();
    } catch (err: any) {
      errorVal = err.message || 'Failed to delete project';
    }
  };

  return {
    get projects() { return projectsVal; },
    set projects(v) { projectsVal = v; },

    get editingProject() { return editingProjectVal; },
    set editingProject(v) { editingProjectVal = v; },

    get isProjectEditModalOpen() { return isProjectEditModalOpenVal; },
    set isProjectEditModalOpen(v) { isProjectEditModalOpenVal = v; },

    get error() { return errorVal; },
    set error(v) { errorVal = v; },

    fetchProjects,
    handleCreateProject,
    handleEditProject,
    handleSaveProject,
    handleDeleteProject,
  };
}
