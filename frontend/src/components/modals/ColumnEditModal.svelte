<script lang="ts">
  import { X, Slash, Trash2 } from '@lucide/svelte';
  import { useI18n } from '@/composables/useI18n';
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';

  let {
    isOpen,
    bucketName,
    initialTitle,
    initialSubtitle = null,
    initialColor = null,
    initialLayout = 'list',
    initialMaxTasks = null,
    tasksCount = 0,
    initialIsDefault = false,
    onclose,
    ondeletecolumn,
    onsave
  } = $props<{
    isOpen: boolean;
    bucketName: string;
    initialTitle: string;
    initialSubtitle?: string | null;
    initialColor?: string | null;
    initialLayout?: 'list' | 'grid-2' | 'grid-3';
    initialMaxTasks?: number | null;
    tasksCount?: number;
    initialIsDefault?: boolean;
    onclose?: () => void;
    ondeletecolumn?: () => void;
    onsave?: (payload: {
      bucketName: string;
      title: string;
      subtitle: string;
      color: string | null;
      layout: 'list' | 'grid-2' | 'grid-3';
      max_tasks: number | null;
      is_default: boolean;
    }) => void;
  }>();

  const { t } = useI18n();

  let title = $state('');
  let subtitle = $state('');
  let color = $state<string | null>(null);
  let layout = $state<'list' | 'grid-2' | 'grid-3'>('list');
  let maxTasks = $state<number | null>(null);
  let isDefault = $state(false);
  let titleInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (isOpen) {
      title = initialTitle || '';
      subtitle = initialSubtitle || '';
      color = initialColor || null;
      layout = initialLayout || 'list';
      maxTasks = initialMaxTasks !== undefined ? initialMaxTasks : null;
      isDefault = initialIsDefault || false;
      
      setTimeout(() => {
        titleInput?.focus();
      }, 50);
    }
  });

  const handleDelete = () => {
    if (tasksCount > 0) return;
    ondeletecolumn?.();
    onclose?.();
  };

  const colors = [
    { id: 'red', name: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-500' },
    { id: 'orange', name: 'Orange', bg: 'bg-amber-600', ring: 'ring-amber-600' },
    { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-500' },
    { id: 'green', name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { id: 'blue', name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
    { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
    { id: 'pink', name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
  ];

  const handleSave = (e?: Event) => {
    if (e) e.preventDefault();
    const cleanTitle = (title || '').trim();
    const cleanSubtitle = (subtitle || '').trim();
    if (!cleanTitle) return;

    let parsedMaxTasks: number | null = null;
    if (maxTasks !== null && maxTasks !== undefined) {
      const valStr = String(maxTasks).trim();
      if (valStr !== '') {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          parsedMaxTasks = parsed;
        }
      }
    }

    onsave?.({
      bucketName,
      title: cleanTitle,
      subtitle: cleanSubtitle,
      color,
      layout,
      max_tasks: parsedMaxTasks,
      is_default: isDefault,
    });
    onclose?.();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onclose?.();
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" transition:fade={{ duration: 150 }}>
    <!-- Backdrop -->
    <button class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-default border-none w-full h-full" onclick={onclose}></button>

    <!-- Modal Content -->
    <div
      class="relative bg-theme-base border border-theme-border w-full max-w-md rounded shadow-2xl overflow-hidden flex flex-col z-10 animate-scale-up"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
        <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{t('columnEdit.title')}</h3>
        <button
          onclick={onclose}
          class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
        >
          <X class="w-4 h-4 shrink-0" />
        </button>
      </div>

      <!-- Form Body -->
      <form onsubmit={handleSave} class="p-4 space-y-4">
        <!-- Title Input -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="columnTitle">
            {t('columnEdit.titleLabel')}
          </label>
          <input
            id="columnTitle"
            bind:this={titleInput}
            bind:value={title}
            type="text"
            required
            class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            placeholder="e.g. In Progress"
          />
        </div>

        <!-- Subtitle Input -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="columnSubtitle">
            {t('columnEdit.subtitleLabel')}
          </label>
          <input
            id="columnSubtitle"
            bind:value={subtitle}
            type="text"
            class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring font-sans italic"
            placeholder="Add description..."
          />
        </div>

        <!-- Max Tasks Limit Input -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="columnMaxTasks">
            {t('columnEdit.maxTasksLabel')}
          </label>
          <input
            id="columnMaxTasks"
            bind:value={maxTasks}
            type="number"
            min="1"
            step="1"
            class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            placeholder={t('columnEdit.maxTasksPlaceholder')}
          />
        </div>

        <!-- Highlight Color Selector -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="colorSelect">
            {t('columnEdit.colorLabel')}
          </label>
          <div id="colorSelect" class="flex flex-wrap gap-2.5 items-center">
            <!-- None Option -->
            <button
              type="button"
              onclick={() => color = null}
              class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main {
                color === null
                  ? 'ring-2 ring-theme-accent ring-offset-2 ring-offset-theme-base bg-theme-card/80 border-theme-accent/60'
                  : 'bg-theme-card/30 hover:bg-theme-card'
              }"
              title={t('columnEdit.colorNone')}
            >
              <Slash class="w-3 h-3 shrink-0 rotate-90" />
            </button>

            <!-- Colors -->
            {#each colors as c (c.id)}
              <button
                type="button"
                onclick={() => color = c.id}
                class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95 {c.bg} {color === c.id ? `ring-2 ring-offset-2 ring-offset-theme-base ${c.ring}` : ''}"
                title={c.name}
              ></button>
            {/each}
          </div>
        </div>

        <!-- Layout Style Selector -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="layoutSelect">
            {t('columnEdit.layoutLabel')}
          </label>
          <div id="layoutSelect" class="grid grid-cols-3 gap-2 bg-theme-base/40 border border-theme-border rounded p-1">
            <button
              type="button"
              onclick={() => layout = 'list'}
              class="px-2 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 {
                layout === 'list'
                  ? 'bg-theme-primary text-white shadow-sm font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/30'
              }"
            >
              <span>{t('columnEdit.layoutList')}</span>
            </button>
            <button
              type="button"
              onclick={() => layout = 'grid-2'}
              class="px-2 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 {
                layout === 'grid-2'
                  ? 'bg-theme-primary text-white shadow-sm font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/30'
              }"
            >
              <span>{t('columnEdit.layoutGrid2')}</span>
            </button>
            <button
              type="button"
              onclick={() => layout = 'grid-3'}
              class="px-2 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 {
                layout === 'grid-3'
                  ? 'bg-theme-primary text-white shadow-sm font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/30'
              }"
            >
              <span>{t('columnEdit.layoutGrid3')}</span>
            </button>
          </div>
        </div>

        <!-- Default Column Checkbox -->
        <div class="flex items-center gap-2 pt-1">
          <input
            id="isDefaultColumn"
            bind:checked={isDefault}
            type="checkbox"
            class="w-4 h-4 rounded border-theme-border text-theme-primary focus:ring-theme-ring focus:ring-opacity-25 bg-theme-base/60 cursor-pointer accent-theme-primary"
          />
          <label
            for="isDefaultColumn"
            class="text-xs font-bold uppercase tracking-wider text-theme-text-muted cursor-pointer select-none hover:text-theme-text-main transition-colors"
          >
            {t('columnEdit.defaultLabel')}
          </label>
        </div>
      </form>

      <!-- Footer Buttons -->
      <div class="px-4 py-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30 shrink-0">
        <!-- Left Side: Delete Button -->
        <div>
          <button
            type="button"
            onclick={handleDelete}
            disabled={tasksCount > 0}
            class="text-xs font-semibold px-2.5 py-1.5 rounded border flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 {
              tasksCount > 0
                ? 'text-theme-text-muted/30 border-theme-border/30 cursor-not-allowed opacity-40'
                : 'text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border-red-500/20'
            }"
            title={tasksCount > 0 ? t('deleteColumnDisabledTooltip') : t('deleteColumnTooltip')}
          >
            <Trash2 class="w-3.5 h-3.5 shrink-0" />
            {t('deleteColumnTooltip')}
          </button>
        </div>

        <!-- Right Side: Cancel & Save Buttons -->
        <div class="flex gap-2">
          <button
            type="button"
            onclick={onclose}
            class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
          >
            {t('buttons.cancel')}
          </button>
          <button
            type="button"
            onclick={handleSave}
            class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all cursor-pointer"
            disabled={!title.trim()}
          >
            {t('columnEdit.saveButton')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
