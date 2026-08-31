import { ref, computed, type Ref } from 'vue';

interface DragSelectOptions {
  selectedIds: Ref<Set<string>>;
}

export function useDragSelect({ selectedIds }: DragSelectOptions) {
  const active = ref(false);
  const startX = ref(0);
  const startY = ref(0);
  const currentX = ref(0);
  const currentY = ref(0);

  // Store the selection state that existed when the drag started
  let initialSelectedIds = new Set<string>();

  const dragSelectStyle = computed(() => {
    if (!active.value) return {};
    const left = Math.min(startX.value, currentX.value);
    const top = Math.min(startY.value, currentY.value);
    const width = Math.abs(startX.value - currentX.value);
    const height = Math.abs(startY.value - currentY.value);
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '1.5px solid var(--theme-accent)',
      backgroundColor: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)',
      backdropFilter: 'blur(0.5px)',
      boxShadow: '0 0 10px var(--theme-ring)',
      pointerEvents: 'none' as const,
      borderRadius: '6px',
      zIndex: 9999,
    };
  });

  const onMouseDown = (event: MouseEvent) => {
    // Only handle primary left click
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;

    // Do not start drag-select if clicking inside task cards, draggable items, timeblock view or standard interactive elements
    if (target.closest('.task-card, [draggable="true"], .timeblock-view, .timeboxing-view')) return;
    if (target.closest('button, input, textarea, select, a, [role="button"]')) return;
    if (target.closest('.column-drag-handle')) return;
    if (target.closest('.modal, [role="dialog"], .dropdown-menu, .popover')) return;

    // Prevent default browser text selection while dragging
    event.preventDefault();

    startX.value = event.clientX;
    startY.value = event.clientY;
    currentX.value = event.clientX;
    currentY.value = event.clientY;

    // If neither Shift nor Ctrl/Meta is held, start fresh (clear selection)
    const isAccumulating = event.shiftKey || event.ctrlKey || event.metaKey;
    if (!isAccumulating) {
      selectedIds.value = new Set();
      initialSelectedIds = new Set();
    } else {
      initialSelectedIds = new Set(selectedIds.value);
    }

    active.value = false; // Will become active on mousemove if we move past threshold

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (event: MouseEvent) => {
    currentX.value = event.clientX;
    currentY.value = event.clientY;

    // Threshold of 4px to avoid tiny accidental drag selections on simple clicks
    const distance = Math.sqrt(Math.pow(currentX.value - startX.value, 2) + Math.pow(currentY.value - startY.value, 2));

    if (!active.value && distance > 4) {
      active.value = true;
    }

    if (active.value) {
      updateSelection(event.shiftKey || event.ctrlKey || event.metaKey);
    }
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    active.value = false;
  };

  const updateSelection = (isAccumulating: boolean) => {
    const x1 = Math.min(startX.value, currentX.value);
    const y1 = Math.min(startY.value, currentY.value);
    const x2 = Math.max(startX.value, currentX.value);
    const y2 = Math.max(startY.value, currentY.value);

    const cards = document.querySelectorAll('.task-card');
    const newlyDraggedIds = new Set<string>();

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const taskId = card.getAttribute('data-task-id');
      if (!taskId) return;

      // Overlap condition
      const overlaps = !(rect.right < x1 || rect.left > x2 || rect.bottom < y1 || rect.top > y2);

      if (overlaps) {
        newlyDraggedIds.add(taskId);
      }
    });

    if (isAccumulating) {
      // Union of initial selection and currently dragged selection
      const updated = new Set(initialSelectedIds);
      newlyDraggedIds.forEach((id) => updated.add(id));
      selectedIds.value = updated;
    } else {
      selectedIds.value = newlyDraggedIds;
    }
  };

  return {
    active,
    dragSelectStyle,
    onMouseDown,
  };
}
