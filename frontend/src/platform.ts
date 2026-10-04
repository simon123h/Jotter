import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor (Android) shell. */
export const isNativeMobile = Capacitor.isNativePlatform();

/** True for the static GitHub Pages demo, which stores everything in localStorage. */
export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('github.io') || window.location.hostname.includes('githubpreview.dev')));
