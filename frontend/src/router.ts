import { createRouter, createWebHashHistory } from 'vue-router';
import MainLayout from '@/components/layout/MainLayout.vue';
import ProjectLayout from '@/components/layout/ProjectLayout.vue';
import { useUiStore, STICKY_VIEW_MODES, SESSION_VIEW_MODES } from '@/stores/ui';

// Lazy-loaded views for code splitting
const HomeView = () => import('@/components/views/HomeView.vue');
const BoardView = () => import('@/components/views/BoardView.vue');
const ListView = () => import('@/components/views/ListView.vue');
const MatrixView = () => import('@/components/views/MatrixView.vue');
const TimeView = () => import('@/components/views/TimeView.vue');
const TagView = () => import('@/components/views/TagView.vue');
const TriageView = () => import('@/features/task-triage/components/TriageView.vue');
const ReviewView = () => import('@/components/views/ReviewView.vue');
const CanvasView = () => import('@/features/canvas/components/CanvasView.vue');
const SettingsView = () => import('@/features/settings/components/SettingsView.vue');
const TaskDetailModal = () => import('@/features/task-editor/components/TaskDetailModal.vue');

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
            const fromRoute = router?.currentRoute?.value;
            const fromMode = (fromRoute?.meta?.backRoute as string) || String(fromRoute?.name || '');
            if (SESSION_VIEW_MODES.includes(fromMode as any)) {
              return {
                name: 'board',
                params: { projectId: to.params.projectId },
              };
            }
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
          {
            path: 'review',
            name: 'review',
            component: ReviewView,
          },
          {
            path: 'review/tasks/:taskId',
            name: 'review-task',
            components: {
              default: ReviewView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'review' },
          },
          {
            path: 'canvas/:canvasId?',
            name: 'canvas',
            component: CanvasView,
          },
          {
            path: 'canvas/:canvasId?/tasks/:taskId',
            name: 'canvas-task',
            components: {
              default: CanvasView,
              modal: TaskDetailModal,
            },
            meta: { backRoute: 'canvas' },
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
    if (to.params.projectId && STICKY_VIEW_MODES.includes(currentMode as any)) {
      uiStore.setLastViewMode(currentMode);
    }
  } catch {
    // Fail-safe in case store is accessed before pinia activation
  }
});

export default router;
