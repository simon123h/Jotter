import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useTimeblockDrag } from '../useTimeblockDrag';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { useModalStore } from '@/stores/modal';
import { HOUR_HEIGHT } from '../../utils/timeGrid';
import type { Timeblock } from '@/types';

vi.mock('@/api', () => ({
  getTimeblocks: vi.fn().mockResolvedValue([]),
  createTimeblock: vi.fn(),
  updateTimeblock: vi.fn(),
  deleteTimeblock: vi.fn(),
  allocateTaskToTimeblock: vi.fn(),
}));

const HALF_HOUR_PX = HOUR_HEIGHT / 2;

const tb: Timeblock = {
  id: 'tb-1',
  title: 'Focus',
  date: '2026-01-01',
  start_time: '09:00',
  end_time: '10:00',
  task_ids: [],
};

const mouseDown = (clientY: number, overrides: Partial<{ button: number; target: HTMLElement }> = {}) =>
  ({
    button: 0,
    clientY,
    target: document.createElement('div'),
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as MouseEvent;

const moveTo = (clientY: number) => window.dispatchEvent(new MouseEvent('mousemove', { clientY }));
const release = async () => {
  window.dispatchEvent(new MouseEvent('mouseup'));
  await flushPromises();
};

describe('useTimeblockDrag', () => {
  let update: ReturnType<typeof vi.fn>;
  let openEdit: ReturnType<typeof vi.fn>;
  let drag: ReturnType<typeof useTimeblockDrag>;

  beforeEach(() => {
    setActivePinia(createPinia());
    update = vi.spyOn(useTimeblockStore(), 'updateTimeblock').mockResolvedValue(undefined as any) as any;
    openEdit = vi.spyOn(useModalStore(), 'openTimeblockEdit').mockImplementation(() => {}) as any;
    drag = useTimeblockDrag(ref(6), ref(18));
  });

  describe('move', () => {
    it('snaps to 15 minutes and saves the new start and end on release', async () => {
      drag.startMove(mouseDown(100), tb);
      moveTo(100 + HALF_HOUR_PX);

      expect(drag.movingTimeblockId.value).toBe('tb-1');
      expect(drag.getEffectiveTimeblock(tb)).toMatchObject({ start_time: '09:30', end_time: '10:30' });

      await release();
      expect(update).toHaveBeenCalledWith('tb-1', { start_time: '09:30', end_time: '10:30' });
      expect(drag.movingTimeblockId.value).toBeNull();
      expect(drag.getEffectiveTimeblock(tb)).toBe(tb);
    });

    it('clamps to the visible hours', async () => {
      drag.startMove(mouseDown(5000), tb);
      moveTo(0);
      expect(drag.getEffectiveTimeblock(tb)).toMatchObject({ start_time: '06:00', end_time: '07:00' });

      moveTo(10000);
      expect(drag.getEffectiveTimeblock(tb)).toMatchObject({ start_time: '18:00', end_time: '19:00' });
      await release();
    });

    it('opens the editor on a click without movement and does not save', async () => {
      drag.startMove(mouseDown(100), tb);
      moveTo(102);
      await release();

      expect(openEdit).toHaveBeenCalledWith(tb);
      expect(update).not.toHaveBeenCalled();
    });

    it('does not save when the block ends up where it started', async () => {
      drag.startMove(mouseDown(100), tb);
      moveTo(120);
      moveTo(100);
      await release();
      expect(update).not.toHaveBeenCalled();
      expect(openEdit).not.toHaveBeenCalled();
    });

    it('ignores non-primary buttons and presses on interactive children', async () => {
      drag.startMove(mouseDown(100, { button: 2 }), tb);

      const button = document.createElement('button');
      drag.startMove(mouseDown(100, { target: button }), tb);

      moveTo(300);
      await release();
      expect(drag.movingTimeblockId.value).toBeNull();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('snaps the new end to 15 minutes and saves only the end time', async () => {
      drag.startResize(mouseDown(100), tb);
      moveTo(100 + HALF_HOUR_PX);

      expect(drag.resizingTimeblockId.value).toBe('tb-1');
      expect(drag.getEffectiveTimeblock(tb)).toMatchObject({ start_time: '09:00', end_time: '10:30' });

      await release();
      expect(update).toHaveBeenCalledWith('tb-1', { end_time: '10:30' });
      expect(drag.resizingTimeblockId.value).toBeNull();
    });

    it('never shrinks below 15 minutes and never grows past the last visible hour', async () => {
      drag.startResize(mouseDown(5000), tb);
      moveTo(0);
      expect(drag.getEffectiveTimeblock(tb).end_time).toBe('09:15');

      moveTo(20000);
      expect(drag.getEffectiveTimeblock(tb).end_time).toBe('19:00');
      await release();
    });

    it('stops the press from reaching the move handler', () => {
      const event = mouseDown(100);
      drag.startResize(event, tb);
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  it('restores body styles after a drag', async () => {
    drag.startMove(mouseDown(100), tb);
    moveTo(200);
    expect(document.body.style.cursor).toBe('move');
    await release();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });
});
