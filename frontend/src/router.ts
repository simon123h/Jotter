import { createRouter, createWebHashHistory } from 'vue-router';
import MainLayout from '@/components/layout/MainLayout.vue';
import ProjectLayout from '@/components/layout/ProjectLayout.vue';
import BoardView from '@/components/views/BoardView.vue';
import ListView from '@/components/views/ListView.vue';
import MatrixView from '@/components/views/MatrixView.vue';
import TimeView from '@/components/views/TimeView.vue';
import TagView from '@/components/views/TagView.vue';
import TriageView from '@/components/views/TriageView.vue';
import SettingsView from '@/components/views/SettingsView.vue';
import HomeView from '@/components/views/HomeView.vue';
import TaskDetailModal from '@/components/modals/TaskDetailModal.vue';
import { useUiStore } from '@/stores/ui';

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
      },
      {
        path: 'project/:projectId',
        name: 'project',
        component: ProjectLayout,
        redirect: (to: any) => {
          try {
            const uiStore = useUiStore();
            return {
              name: uiStore.lastViewMode || 'board',
              params: { projectId: to.params.projectId },
            };
          } catch {
            return {
              name: 'board',
              params: { projectId: to.params.projectId },
            };
          }
        },
        children: [
          {
            path: 'board',
            name: 'board',
            component: BoardView,
          },
          {
            path: 'board/tasks/:taskId',
            name: 'board-task',
            components: {
              default: BoardView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'board' },
          },
          {
            path: 'list',
            name: 'list',
            component: ListView,
          },
          {
            path: 'list/tasks/:taskId',
            name: 'list-task',
            components: {
              default: ListView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'list' },
          },
          {
            path: 'matrix',
            name: 'matrix',
            component: MatrixView,
          },
          {
            path: 'matrix/tasks/:taskId',
            name: 'matrix-task',
            components: {
              default: MatrixView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'matrix' },
          },
          {
            path: 'time',
            name: 'time',
            component: TimeView,
          },
          {
            path: 'time/tasks/:taskId',
            name: 'time-task',
            components: {
              default: TimeView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'time' },
          },
          {
            path: 'tag',
            name: 'tag',
            component: TagView,
          },
          {
            path: 'tag/tasks/:taskId',
            name: 'tag-task',
            components: {
              default: TagView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'tag' },
          },
          {
            path: 'triage',
            name: 'triage',
            component: TriageView,
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  try {
    const uiStore = useUiStore();
    const currentMode = (to.meta.backRoute as string) || String(to.name || '');
    if (to.params.projectId && ['board', 'list', 'matrix', 'time', 'tag', 'triage'].includes(currentMode)) {
      uiStore.setLastViewMode(currentMode);
    }
  } catch {
    // Fail-safe in case store is accessed before pinia activation
  }
});

export default router;
