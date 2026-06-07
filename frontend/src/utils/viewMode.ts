export type ViewMode = 'board' | 'list' | 'matrix' | 'time' | 'tag' | 'global-time' | 'settings' | 'home';

const viewModeMap: Record<string, ViewMode> = {
  'home': 'home',
  'board': 'board',
  'board-task': 'board',
  'list': 'list',
  'list-task': 'list',
  'matrix': 'matrix',
  'matrix-task': 'matrix',
  'time': 'time',
  'time-task': 'time',
  'tag': 'tag',
  'tag-task': 'tag',
  'global-time': 'global-time',
  'global-time-task': 'global-time',
  'settings': 'settings',
};

export function getViewMode(routeName: string | symbol | null | undefined): ViewMode {
  if (!routeName) return 'board';
  return viewModeMap[routeName.toString()] || 'board';
}
