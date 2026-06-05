import { createRouter, createWebHashHistory } from 'vue-router';
import KanbanBoard from '@/components/KanbanBoard.vue';

const routes = [
  {
    path: '/',
    redirect: () => {
      const activeProj = localStorage.getItem('jotter-active-project-id');
      const activeView = localStorage.getItem('jotter-view-mode') || 'board';

      if (activeProj) {
        return `/projects/${activeProj}/${activeView}`;
      }

      // If no project is known, let the component handle selection after fetching
      return `/projects/init/${activeView}`;
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
