<script lang="ts">
  import { X, Trash2 } from '@lucide/svelte';
  import { useI18n } from '@/composables/useI18n';
  import type { Project } from '@/types';
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';

  let {
    isOpen,
    project,
    onclose,
    ondeleteproject,
    onsave
  } = $props<{
    isOpen: boolean;
    project: Project | null;
    onclose?: () => void;
    ondeleteproject?: () => void;
    onsave?: (payload: { id: string; title: string; done_clean_period: number | null }) => void;
  }>();

  const { t } = useI18n();

  let title = $state('');
  let doneCleanPeriod = $state<number | null>(null);
  let titleInput = $state<HTMLInputElement | null>(null);

  // Sync state when isOpen changes or project changes
  $effect(() => {
    if (isOpen && project) {
      title = project.title || '';
      doneCleanPeriod =
        project.done_clean_period !== undefined && project.done_clean_period !== null ? project.done_clean_period : null;
      
      setTimeout(() => {
        titleInput?.focus();
      }, 50);
    }
  });

  const handleSave = (e?: Event) => {
    if (e) e.preventDefault();
    const cleanTitle = (title || '').trim();
    if (!cleanTitle || !project) return;

    let parsedPeriod: number | null = null;
    if (doneCleanPeriod !== null && doneCleanPeriod !== undefined) {
      const valStr = String(doneCleanPeriod).trim();
      if (valStr !== '') {
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          parsedPeriod = parsed === 0 ? null : parsed;
        }
      }
    }

    onsave?.({
      id: project.id,
      title: cleanTitle,
      done_clean_period: parsedPeriod,
    });
    onclose?.();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onclose?.();
    }
  };

  const handleDelete = () => {
    ondeleteproject?.();
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
        <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{t('projectEdit.title')}</h3>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="projTitle">
            {t('projectEdit.titleLabel')}
          </label>
          <input
            id="projTitle"
            bind:this={titleInput}
            bind:value={title}
            type="text"
            required
            maxlength="100"
            class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
          />
        </div>

        <!-- Done Task Deletion Period Input -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="projPrune">
            {t('projectEdit.prunePeriodLabel')}
          </label>
          <input
            id="projPrune"
            bind:value={doneCleanPeriod}
            type="number"
            min="0"
            placeholder={t('projectEdit.prunePeriodPlaceholder')}
            class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
          />
          <p class="mt-1 text-[11px] text-theme-text-muted leading-relaxed">
            {t('projectEdit.prunePeriodHelp')}
          </p>
        </div>

        <!-- Footer Action Buttons -->
        <div class="flex justify-end items-center gap-2 pt-2 border-t border-theme-border mt-4">
          <!-- Delete Project Button -->
          <button
            type="button"
            onclick={handleDelete}
            class="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded text-xs font-semibold transition-all cursor-pointer mr-auto"
          >
            <Trash2 class="w-3.5 h-3.5" /> {t('projectEdit.deleteButton') || 'Delete'}
          </button>

          <button
            type="button"
            onclick={onclose}
            class="px-4 py-2 border border-theme-border rounded text-sm font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
          >
            {t('buttons.cancel')}
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-sm font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            {t('projectEdit.saveButton')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
