import { onMounted, onUnmounted } from 'vue';
import { App } from '@capacitor/app';
import { useRouter, useRoute } from 'vue-router';
import { useModalStore } from '@/stores/modal';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { isNativeMobile } from '@/storage';

/**
 * Handles the Android hardware/gesture back button.
 * Prioritizes closing open modals/dialogs, then open sheets/sidebars, then detail routes, then normal history.
 */
export function useAndroidBackButton() {
  const modalStore = useModalStore();
  const settingsStore = useSettingsStore();
  const uiStore = useUiStore();
  const router = useRouter();
  const route = useRoute();

  let removeListener: (() => void) | null = null;

  onMounted(async () => {
    if (!isNativeMobile) return;

    try {
      const handle = await App.addListener('backButton', () => {
        // 1. If any utility modal is open in modalStore, close it
        if (modalStore.activeModal) {
          modalStore.closeModal();
          return;
        }

        // 2. If mobile views bottom sheet is open, close it
        if (uiStore.isMobileViewsSheetOpen) {
          uiStore.isMobileViewsSheetOpen = false;
          return;
        }

        // 3. If mobile sidebar is open, close it
        if (settingsStore.isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
          settingsStore.isSidebarOpen = false;
          return;
        }

        // 4. If TaskDetailModal route is active (route has taskId param), navigate back to parent project
        if (route.params.taskId) {
          const projectId = (route.params.projectId as string) || 'default';
          router.push({ name: 'project', params: { projectId } });
          return;
        }

        // 3. Fallback to router.back() or exit app if on root
        if (window.history.length > 1) {
          router.back();
        } else {
          App.exitApp();
        }
      });

      removeListener = () => {
        handle.remove();
      };
    } catch {
      // Ignore on unsupported platforms
    }
  });

  onUnmounted(() => {
    if (removeListener) {
      removeListener();
    }
  });
}
