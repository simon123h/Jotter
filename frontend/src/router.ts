import { createRouter, createWebHashHistory } from 'vue-router';
import KanbanBoard from './components/KanbanBoard.vue';

const routes = [
  {
    path: '/',
    redirect: () => {
      const activeProj = localStorage.getItem('jotter-active-project-id') || 'default';
      const activeView = localStorage.getItem('jotter-view-mode') || 'board';
      return `/projects/${activeProj}/${activeView}`;
    },
  },
  {
    path: '/projects/:projectId/:viewMode',
    name: 'project-view',
    component: KanbanBoard,
  },
  {
    path: '/projects/:projectId/:viewMode/tasks/:taskId',
    name: 'task-detail',
    component: KanbanBoard,
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

export default router;
