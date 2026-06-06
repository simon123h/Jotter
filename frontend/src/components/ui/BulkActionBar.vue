<script setup lang="ts">
import { ref } from 'vue';
import { 
  X, Trash2, Layers, Tag, Flag, Clock, ArrowRightLeft, 
  ChevronRight, Plus
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket, Project } from '@/types';

const { t } = useI18n();

const props = defineProps<{
  selectedCount: number;
  buckets: Bucket[];
  projects: Project[];
  activeProjectId: string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'delete'): void;
  (e: 'move-bucket', bucket: string): void;
  (e: 'add-tag', tag: string): void;
  (e: 'remove-tag', tag: string): void;
  (e: 'set-priority', priority: string): void;
  (e: 'set-planned', planned: string): void;
  (e: 'move-project', projectId: string): void;
}>();

const activeMenu = ref<'none' | 'bucket' | 'tag' | 'priority' | 'planned' | 'project'>('none');

const toggleMenu = (menu: typeof activeMenu.value) => {
  activeMenu.value = activeMenu.value === menu ? 'none' : menu;
};

const newTagName = ref('');
const handleAddTag = () => {
  if (newTagName.value.trim()) {
    emit('add-tag', newTagName.value.trim());
    newTagName.value = '';
    activeMenu.value = 'none';
  }
};
</script>

<template>
  <transition name="slide-up">
    <div 
      v-if="selectedCount > 0"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2"
    >
      <!-- Nested Menus -->
      <div 
        v-if="activeMenu !== 'none'"
        class="bg-theme-card border border-theme-border rounded-lg shadow-2xl p-1.5 min-w-[200px] mb-1 animate-in fade-in zoom-in duration-150"
      >
        <!-- Bucket Menu -->
        <div v-if="activeMenu === 'bucket'" class="flex flex-col">
          <button 
            v-for="b in buckets" 
            :key="b.name"
            @click="emit('move-bucket', b.name); activeMenu = 'none'"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left"
          >
            <div v-if="b.color" class="w-2 h-2 rounded-full" :style="{ backgroundColor: b.color }"></div>
            {{ t('buckets.' + b.name) !== 'buckets.' + b.name ? t('buckets.' + b.name) : b.title }}
          </button>
        </div>

        <!-- Tag Menu -->
        <div v-if="activeMenu === 'tag'" class="p-2 space-y-3">
          <div class="flex items-center gap-2">
            <input 
              v-model="newTagName"
              @keyup.enter="handleAddTag"
              type="text" 
              placeholder="Tag name..."
              class="flex-grow bg-theme-base border border-theme-border rounded px-2 py-1 text-xs focus:outline-none focus:border-theme-primary"
            />
            <button @click="handleAddTag" class="p-1 bg-theme-primary text-white rounded hover:bg-theme-primary-hover">
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Priority Menu -->
        <div v-if="activeMenu === 'priority'" class="flex flex-col">
          <button 
            v-for="p in ['none', 'low', 'medium', 'high', 'urgent']" 
            :key="p"
            @click="emit('set-priority', p === 'none' ? '' : p); activeMenu = 'none'"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left capitalize"
          >
            <Flag class="w-3.5 h-3.5" :class="{
              'text-blue-400': p === 'low',
              'text-yellow-400': p === 'medium',
              'text-orange-400': p === 'high',
              'text-red-400': p === 'urgent',
              'text-theme-text-muted': p === 'none'
            }" />
            {{ p === 'none' ? t('priorityOptions.none') : t('priorityOptions.' + p) }}
          </button>
        </div>

        <!-- Planned Menu -->
        <div v-if="activeMenu === 'planned'" class="flex flex-col">
          <button 
            v-for="p in ['', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'sometime']" 
            :key="p"
            @click="emit('set-planned', p); activeMenu = 'none'"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left"
          >
            <Clock class="w-3.5 h-3.5 text-theme-text-muted" />
            {{ p === '' ? t('plannedDateOptions.none') : t('plannedDateOptions.' + p) }}
          </button>
        </div>

        <!-- Project Menu -->
        <div v-if="activeMenu === 'project'" class="flex flex-col max-h-64 overflow-y-auto scroller-thin">
          <button 
            v-for="p in projects.filter(p => p.id !== activeProjectId)" 
            :key="p.id"
            @click="emit('move-project', p.id); activeMenu = 'none'"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left"
          >
            <ChevronRight class="w-3.5 h-3.5 text-theme-text-muted" />
            {{ p.title }}
          </button>
        </div>
      </div>

      <!-- Main Action Bar -->
      <div 
        class="bg-slate-900 border border-slate-700 rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md"
      >
        <div class="flex items-center gap-2.5 pr-4 border-r border-slate-700">
          <span class="w-6 h-6 flex items-center justify-center bg-theme-primary text-white rounded-full text-xs font-bold shadow-lg">
            {{ selectedCount }}
          </span>
          <span class="text-xs font-bold text-slate-300 uppercase tracking-widest hidden sm:inline">Selected</span>
        </div>

        <div class="flex items-center gap-1">
          <button 
            @click="toggleMenu('bucket')"
            class="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Move to Column"
          >
            <Layers class="w-4.5 h-4.5" />
          </button>
          
          <button 
            @click="toggleMenu('planned')"
            class="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Plan For..."
          >
            <Clock class="w-4.5 h-4.5" />
          </button>

          <button 
            @click="toggleMenu('tag')"
            class="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Add Tag"
          >
            <Tag class="w-4.5 h-4.5" />
          </button>

          <button 
            @click="toggleMenu('priority')"
            class="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Set Priority"
          >
            <Flag class="w-4.5 h-4.5" />
          </button>

          <button 
            @click="toggleMenu('project')"
            class="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Move to Project"
          >
            <ArrowRightLeft class="w-4.5 h-4.5" />
          </button>

          <div class="w-px h-6 bg-slate-700 mx-1"></div>

          <button 
            @click="emit('delete')"
            class="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all"
            title="Delete Selected"
          >
            <Trash2 class="w-4.5 h-4.5" />
          </button>
        </div>

        <div class="pl-2 border-l border-slate-700">
          <button 
            @click="emit('clear')"
            class="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Clear Selection"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  transform: translate(-50%, 100%) scale(0.9);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translate(-50%, 100%) scale(0.9);
  opacity: 0;
}
</style>
