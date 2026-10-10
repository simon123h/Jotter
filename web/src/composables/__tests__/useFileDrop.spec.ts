import { describe, it, expect, vi } from 'vitest';
import { useFileDrop } from '../useFileDrop';

const dragEvent = (dataTransfer: Partial<DataTransfer>) => ({ preventDefault: vi.fn(), dataTransfer }) as unknown as DragEvent;

describe('useFileDrop', () => {
  it('shows the drop state only while files are dragged over', () => {
    const { isDragging, onDragOver, onDragLeave } = useFileDrop(vi.fn());

    onDragOver(dragEvent({ types: ['text/plain'] }));
    expect(isDragging.value).toBe(false);

    onDragOver(dragEvent({ types: ['Files'] }));
    expect(isDragging.value).toBe(true);

    onDragLeave(dragEvent({}));
    expect(isDragging.value).toBe(false);
  });

  it('passes dropped files to the callback and clears the drop state', async () => {
    const onFiles = vi.fn();
    const { isDragging, onDragOver, onDrop } = useFileDrop(onFiles);
    const files = { length: 1 } as unknown as FileList;

    onDragOver(dragEvent({ types: ['Files'] }));
    const event = dragEvent({ files });
    await onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(isDragging.value).toBe(false);
  });

  it('ignores drops without files', async () => {
    const onFiles = vi.fn();
    const { onDrop } = useFileDrop(onFiles);

    await onDrop(dragEvent({ files: { length: 0 } as unknown as FileList }));
    await onDrop(dragEvent({}));

    expect(onFiles).not.toHaveBeenCalled();
  });
});
