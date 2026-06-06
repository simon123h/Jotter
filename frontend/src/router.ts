import { createRouter, createWebHistory } from 'vue-router';
import KanbanBoard from '@/components/KanbanBoard.vue';
import BoardView from '@/components/views/BoardView.vue';
import ListView from '@/components/views/ListView.vue';
import MatrixView from '@/components/views/MatrixView.vue';
import TimeView from '@/components/views/TimeView.vue';
import TagView from '@/components/views/TagView.vue';
import SuperTimeView from '@/components/views/SuperTimeView.vue';
import SettingsView from '@/components/views/SettingsView.vue';
import TaskDetailModal from '@/components/modals/TaskDetailModal.vue';

import { useSettingsStore } from '@/stores/settings';

const routes = [
  {
    path: '/',
    redirect: () => {
      const settings = useSettingsStore();
      return {
        name: settings.viewMode,
        params: { projectId: settings.activeProjectId },
      };
    },
  },
  {
    path: '/project/:projectId',
    component: KanbanBoard,
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
      },
      {
        path: 'super-time',
        name: 'super-time',
        component: SuperTimeView,
      },
      {
        path: 'super-time/tasks/:taskId',
        name: 'super-time-task',
        components: {
          default: SuperTimeView,
          modal: TaskDetailModal,
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
