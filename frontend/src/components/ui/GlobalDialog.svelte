<script lang="ts">
  import { useDialog } from '@/composables/useDialog';
  import { CheckCircle2, AlertOctagon, AlertTriangle, Info } from '@lucide/svelte';
  import { fade } from 'svelte/transition';

  const dialog = useDialog();
</script>

{#if dialog.isOpen}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" transition:fade={{ duration: 150 }}>
    <!-- Backdrop -->
    <button class="fixed inset-0 bg-slate-950/80 backdrop-blur-[2px] cursor-default border-none w-full h-full" onclick={dialog.handleCancel}></button>

    <!-- Dialog container -->
    <div
      class="relative bg-theme-card border border-theme-border w-full max-w-xs sm:max-w-sm rounded shadow-2xl p-5 z-10 flex flex-col items-center text-center transform scale-100 transition-all"
    >
      <!-- Icon representation -->
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm {
          dialog.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
          dialog.type === 'error' ? 'bg-red-500/10 text-red-500' :
          dialog.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
          'bg-theme-primary/10 text-theme-accent'
        }"
      >
        {#if dialog.type === 'success'}
          <CheckCircle2 class="w-6 h-6" />
        {:else if dialog.type === 'error'}
          <AlertOctagon class="w-6 h-6" />
        {:else if dialog.type === 'warning'}
          <AlertTriangle class="w-6 h-6" />
        {:else}
          <Info class="w-6 h-6" />
        {/if}
      </div>

      <!-- Title & Message -->
      {#if dialog.title}
        <h3 class="text-sm font-bold text-theme-text-main mb-1.5 tracking-wide uppercase">
          {dialog.title}
        </h3>
      {/if}
      <p class="text-theme-text-muted text-xs leading-relaxed mb-4 max-w-[260px] break-words">
        {dialog.message}
      </p>

      <!-- Action Buttons -->
      <div class="flex items-center justify-center gap-2 w-full">
        {#if dialog.showCancel}
          <button
            type="button"
            onclick={dialog.handleCancel}
            class="flex-1 text-xs font-semibold py-1.5 px-3 bg-theme-base hover:bg-theme-column/60 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
          >
            {dialog.cancelText}
          </button>
        {/if}
        <button
          type="button"
          onclick={dialog.handleConfirm}
          class="text-xs font-semibold py-1.5 px-3 text-white rounded shadow-sm transition-all cursor-pointer {
            dialog.showCancel ? 'flex-1' : 'w-24'
          } {
            dialog.type === 'error' ? 'bg-red-600 hover:bg-red-500' :
            dialog.type === 'warning' ? 'bg-amber-600 hover:bg-amber-500' :
            'bg-theme-primary hover:bg-theme-primary-hover'
          }"
        >
          {dialog.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
