import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '../haptics';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
    notification: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}));

vi.mock('@/storage', () => ({
  isNativeMobile: true,
}));

describe('haptics utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers light haptic impact', async () => {
    await triggerLightHaptic();
    expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
  });

  it('triggers medium haptic impact', async () => {
    await triggerMediumHaptic();
    expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Medium });
  });

  it('triggers success haptic notification', async () => {
    await triggerSuccessHaptic();
    expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Success });
  });
});
