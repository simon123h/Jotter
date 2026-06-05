export interface RouteParams {
  projectId: string;
  viewMode: string;
  taskId?: string;
  query: Record<string, string>;
}

function parseHash(hash: string): RouteParams {
  const hashWithoutHash = hash.startsWith('#') ? hash.substring(1) : hash;
  const [pathPart, queryPart] = hashWithoutHash.split('?');

  const segments = pathPart.split('/').filter(Boolean);
  
  let projectId = 'default';
  let viewMode = 'board';
  let taskId: string | undefined = undefined;

  if (segments[0] === 'projects' && segments[1]) {
    projectId = segments[1];
    if (segments[2]) {
      viewMode = segments[2];
    }
    if (segments[3] === 'tasks' && segments[4]) {
      taskId = segments[4];
    }
  } else {
    projectId = localStorage.getItem('jotter-active-project-id') || 'default';
    viewMode = localStorage.getItem('jotter-view-mode') || 'board';
  }

  const query: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((value, key) => {
      query[key] = value;
    });
  }

  return { projectId, viewMode, taskId, query };
}

function stringifyRoute(route: { projectId: string; viewMode: string; taskId?: string; query?: Record<string, string> }): string {
  let path = `#/projects/${route.projectId}/${route.viewMode}`;
  if (route.taskId) {
    path += `/tasks/${route.taskId}`;
  }
  if (route.query && Object.keys(route.query).length > 0) {
    const params = new URLSearchParams();
    Object.entries(route.query).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        params.append(key, val);
      }
    });
    const queryString = params.toString();
    if (queryString) {
      path += `?${queryString}`;
    }
  }
  return path;
}

let currentRouteVal = $state<RouteParams>({
  projectId: 'default',
  viewMode: 'board',
  query: {}
});

if (typeof window !== 'undefined') {
  const initRoute = () => {
    const parsed = parseHash(window.location.hash || '#/');
    currentRouteVal.projectId = parsed.projectId;
    currentRouteVal.viewMode = parsed.viewMode;
    currentRouteVal.taskId = parsed.taskId;
    currentRouteVal.query = parsed.query;
  };

  initRoute();
  
  window.addEventListener('hashchange', initRoute);
}

export const router = {
  get current() {
    return currentRouteVal;
  },

  push(to: { name?: string; params?: { projectId?: string; viewMode?: string; taskId?: string | null }; query?: Record<string, string> }) {
    const nextRoute = {
      projectId: to.params?.projectId || currentRouteVal.projectId,
      viewMode: to.params?.viewMode || currentRouteVal.viewMode,
      taskId: to.params?.taskId === null ? undefined : (to.params?.taskId || currentRouteVal.taskId),
      query: to.query || {}
    };
    window.location.hash = stringifyRoute(nextRoute).replace('#', '');
  },

  replace(to: { query?: Record<string, string> }) {
    const nextRoute = {
      projectId: currentRouteVal.projectId,
      viewMode: currentRouteVal.viewMode,
      taskId: currentRouteVal.taskId,
      query: to.query || {}
    };
    const targetHash = stringifyRoute(nextRoute);
    const targetUrl = window.location.pathname + window.location.search + targetHash;
    window.history.replaceState(null, '', targetUrl);
    
    // Trigger update locally since hashchange might not fire
    const parsed = parseHash(targetHash);
    currentRouteVal.projectId = parsed.projectId;
    currentRouteVal.viewMode = parsed.viewMode;
    currentRouteVal.taskId = parsed.taskId;
    currentRouteVal.query = parsed.query;
  }
};
