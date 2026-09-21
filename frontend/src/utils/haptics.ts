import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeMobile } from '@/storage';

/**
 * Triggers light haptic feedback on mobile touch events (e.g. card drop, checkbox check).
 */
export async function triggerLightHaptic(): Promise<void> {
  if (!isNativeMobile) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Ignore on unsupported platforms
  }
}

/**
 * Triggers medium haptic feedback on actions (e.g. task creation, column delete).
 */
export async function triggerMediumHaptic(): Promise<void> {
  if (!isNativeMobile) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Ignore
  }
}

/**
 * Triggers success haptic notification (e.g. task marked done, sync complete).
 */
export async function triggerSuccessHaptic(): Promise<void> {
  if (!isNativeMobile) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Ignore
  }
}
