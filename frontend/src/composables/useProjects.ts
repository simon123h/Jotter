import { ref, type Ref } from 'vue';
import type { Project } from '../types';
import { getProjects, createProject, updateProject, deleteProject } from '../api';
import { useI18n } from './useI18n';
import { useDialog } from './useDialog';

export function useProjects(activeProjectId: Ref<string>, onSelectProject: (id: string) => void) {
  const { t } = useI18n();
  const { showDialog } = useDialog();

  const projects = ref<Project[]>([]);
  const editingProject = ref<Project | null>(null);
  const isProjectEditModalOpen = ref(false);
  const error = ref<string | null>(null);

  const fetchProjects = async () => {
    try {
      projects.value = await getProjects();
      if (!projects.value.find((p) => p.id === activeProjectId.value)) {
        if (projects.value.length > 0) {
          onSelectProject(projects.value[0].id);
        } else {
          onSelectProject('default');
        }
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch projects';
    }
  };

  const handleCreateProject = async (title: string) => {
    try {
      const created = await createProject(title);
      await fetchProjects();
      onSelectProject(created.id);
    } catch (err: any) {
      error.value = err.message || 'Failed to create project';
    }
  };

  const handleEditProject = (project: Project) => {
    editingProject.value = project;
    isProjectEditModalOpen.value = true;
  };

  const handleSaveProject = async ({ id, title, done_clean_period }: { id: string; title: string; done_clean_period: number | null }) => {
    try {
      await updateProject(id, { title, done_clean_period });
      await fetchProjects();
    } catch (err: any) {
      error.value = err.message || 'Failed to update project';
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
      isProjectEditModalOpen.value = false;
      await fetchProjects();
    } catch (err: any) {
      error.value = err.message || 'Failed to delete project';
    }
  };

  return {
    projects,
    editingProject,
    isProjectEditModalOpen,
    error,
    fetchProjects,
    handleCreateProject,
    handleEditProject,
    handleSaveProject,
    handleDeleteProject,
  };
}
