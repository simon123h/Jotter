import { ref } from 'vue';

/** Drag-and-drop file handling: bind the three handlers to an element and show an overlay while `isDragging`. */
export function useFileDrop(onFiles: (files: FileList) => void | Promise<void>) {
  const isDragging = ref(false);

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes('Files')) {
      isDragging.value = true;
    }
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    isDragging.value = false;
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    isDragging.value = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await onFiles(files);
    }
  };

  return { isDragging, onDragOver, onDragLeave, onDrop };
}
