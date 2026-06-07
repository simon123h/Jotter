import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '@/components/layout/MainLayout.vue';
import ProjectLayout from '@/components/layout/ProjectLayout.vue';
import BoardView from '@/components/views/BoardView.vue';
import ListView from '@/components/views/ListView.vue';
import MatrixView from '@/components/views/MatrixView.vue';
import TimeView from '@/components/views/TimeView.vue';
import TagView from '@/components/views/TagView.vue';
import GlobalTimeView from '@/components/views/GlobalTimeView.vue';
import SettingsView from '@/components/views/SettingsView.vue';
import HomeView from '@/components/views/HomeView.vue';
import TaskDetailModal from '@/components/modals/TaskDetailModal.vue';

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
        component: ProjectLayout,
        children: [
          {
            path: '',
            redirect: (to: any) => {
              return {
                name: 'board',
                params: { projectId: to.params.projectId },
              };
            },
          },
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
            path: 'global-time',
            name: 'global-time',
            component: GlobalTimeView,
            meta: { isGlobal: true },
          },
          {
            path: 'global-time/tasks/:taskId',
            name: 'global-time-task',
            components: {
              default: GlobalTimeView,
              modal: TaskDetailModal,
            },
            meta: { isGlobal: true },
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
  history: createWebHistory(),
  routes,
});

export default router;
