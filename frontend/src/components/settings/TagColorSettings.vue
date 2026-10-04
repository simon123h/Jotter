<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { Check, Tag, RotateCcw, ChevronDown, Search } from '@lucide/vue';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const tagColors = computed(() => settingsStore.tagColors || {});

onMounted(async () => {
  try {
    // Fetch projects and global tasks to build tag color list
    await projectStore.fetchProjects();
    await projectStore.fetchTasks({ projectId: 'all' });
  } catch (err) {
    console.error('Error fetching tasks for tag colors:', err);
  }
});

const tagColorOptions = [
  { id: 'accent', color: 'bg-theme-accent border-theme-accent/30', textClass: 'text-theme-accent' },
  { id: 'sky', color: 'bg-sky-500', textClass: 'text-sky-500' },
  { id: 'emerald', color: 'bg-emerald-500', textClass: 'text-emerald-500' },
  { id: 'indigo', color: 'bg-indigo-500', textClass: 'text-indigo-500' },
  { id: 'violet', color: 'bg-violet-500', textClass: 'text-violet-500' },
  { id: 'amber', color: 'bg-amber-500', textClass: 'text-amber-500' },
  { id: 'rose', color: 'bg-rose-500', textClass: 'text-rose-500' },
  { id: 'teal', color: 'bg-teal-500', textClass: 'text-teal-500' },
  { id: 'fuchsia', color: 'bg-fuchsia-500', textClass: 'text-fuchsia-500' },
  { id: 'orange', color: 'bg-orange-500', textClass: 'text-orange-500' },
  { id: 'pink', color: 'bg-pink-500', textClass: 'text-pink-500' },
  { id: 'cyan', color: 'bg-cyan-500', textClass: 'text-cyan-500' },
  { id: 'purple', color: 'bg-purple-500', textClass: 'text-purple-500' },
  { id: 'red', color: 'bg-red-500', textClass: 'text-red-500' },
];

const allTagsInUse = computed(() => {
  const tagsSet = new Set<string>();
  projectStore.tasks.forEach((t) => {
    if (t.tags) {
      t.tags.forEach((tag) => {
        if (tag.trim()) {
          tagsSet.add(tag.trim().toLowerCase());
        }
      });
    }
  });
  Object.keys(tagColors.value).forEach((tag) => {
    if (tag.trim()) {
      tagsSet.add(tag.trim().toLowerCase());
    }
  });
  return Array.from(tagsSet).sort();
});

const selectedTag = ref<string | null>(null);
const isDropdownOpen = ref(false);
const searchQuery = ref('');
const dropdownRef = ref<HTMLElement | null>(null);

const filteredTags = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return allTagsInUse.value;
  return allTagsInUse.value.filter((tag) => tag.includes(query));
});

const selectTag = (tag: string) => {
  selectedTag.value = tag;
  isDropdownOpen.value = false;
  searchQuery.value = '';
};

onClickOutside(dropdownRef, () => {
  isDropdownOpen.value = false;
});

watch(
  () => allTagsInUse.value,
  (newTags) => {
    if (newTags.length > 0) {
      if (!selectedTag.value || !newTags.includes(selectedTag.value)) {
        selectedTag.value = newTags[0];
      }
    } else {
      selectedTag.value = null;
    }
  },
  { immediate: true }
);

const colorThemes: Record<string, string> = {
  accent: 'bg-theme-accent/10 text-theme-accent border-theme-accent/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const getTagClasses = (tag: string) => {
  const normalized = tag.trim().toLowerCase();
  const custom = tagColors.value[normalized];
  if (custom && colorThemes[custom]) {
    return colorThemes[custom];
  }

  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const themes = [
    'bg-theme-accent/10 text-theme-accent border-theme-accent/20',
    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ];
  return themes[hash % themes.length];
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col">
      <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-1.5">
        <Tag class="w-4 h-4 text-theme-accent shrink-0" />
        {{ t('settingsView.tagColorsTitle') }}
      </h3>
      <p class="text-xs text-theme-text-muted mt-1 leading-relaxed">
        {{ t('settingsView.tagColorsDesc') }}
      </p>
    </div>

    <div
      v-if="allTagsInUse.length === 0"
      class="bg-theme-card/60 border border-theme-border/60 rounded-xl p-6 text-center text-xs text-theme-text-muted"
    >
      {{ t('settingsView.noTagsFound') }}
    </div>

    <div
      v-else
      class="bg-theme-card/60 border border-theme-border/60 rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-6 justify-between animate-in fade-in duration-300"
    >
      <!-- Selector column (Custom Dropdown Selection) -->
      <div ref="dropdownRef" class="flex flex-col gap-2 w-full md:max-w-xs shrink-0 relative">
        <label class="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider select-none">
          {{ t('settingsView.selectTagToCustomize') }}
        </label>

        <button
          @click.stop="isDropdownOpen = !isDropdownOpen"
          class="w-full flex items-center justify-between px-3.5 py-2.5 bg-theme-bg border border-theme-border/60 rounded-xl text-xs text-theme-text-main focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30 transition-all font-bold cursor-pointer uppercase tracking-wider shadow-sm select-none hover:bg-theme-card/30 text-left"
        >
          <!-- Show current tag style or fallback if none selected -->
          <div class="flex items-center gap-2 truncate">
            <span
              v-if="selectedTag"
              class="rounded border uppercase tracking-wider leading-none text-[9px] px-2 py-1 font-extrabold shadow-inner shrink-0"
              :class="getTagClasses(selectedTag)"
            >
              {{ selectedTag }}
            </span>
            <span v-else class="text-theme-text-muted italic select-none">
              {{ t('settingsView.noTagsFound') }}
            </span>
          </div>
          <ChevronDown
            class="w-4 h-4 text-theme-text-muted shrink-0 transition-transform duration-200"
            :class="{ 'rotate-180': isDropdownOpen }"
          />
        </button>

        <!-- Floating Dropdown Panel -->
        <transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="transform scale-95 opacity-0 -translate-y-1"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 -translate-y-1"
        >
          <div
            v-if="isDropdownOpen"
            class="absolute left-0 right-0 top-full mt-1.5 bg-theme-card border border-theme-border rounded-xl shadow-xl z-45 p-2 flex flex-col gap-2 max-h-64"
          >
            <!-- Search box inside dropdown -->
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-text-muted" />
              <input
                v-model="searchQuery"
                type="text"
                @click.stop
                :placeholder="t('settingsView.tagSearchPlaceholder')"
                class="w-full pl-8.5 pr-3 py-2 bg-theme-bg border border-theme-border/60 rounded-lg text-xs text-theme-text-main placeholder:text-theme-text-muted focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30 transition-all font-medium"
              />
            </div>

            <!-- List of tags -->
            <div class="flex-grow overflow-y-auto scroller-thin flex flex-col gap-0.5 max-h-48 pr-1">
              <button
                v-for="tag in filteredTags"
                :key="tag"
                type="button"
                @click="selectTag(tag)"
                class="w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all cursor-pointer text-left hover:bg-theme-column/50"
                :class="
                  selectedTag === tag
                    ? 'bg-theme-primary/10 text-theme-accent font-semibold border-l-2 border-theme-primary rounded-l-none'
                    : 'text-theme-text-card hover:text-theme-text-main'
                "
              >
                <!-- Tag item style preview -->
                <span
                  class="rounded border uppercase tracking-wider leading-none text-[9px] px-2 py-1 font-extrabold shadow-sm shrink-0"
                  :class="getTagClasses(tag)"
                >
                  {{ tag }}
                </span>

                <Check v-if="selectedTag === tag" class="w-3.5 h-3.5 text-theme-primary shrink-0" />
              </button>

              <div v-if="filteredTags.length === 0" class="text-center py-4 text-xs text-theme-text-muted italic select-none">
                {{ t('settingsView.noMatchingTags') }}
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Color Adjuster row/panel -->
      <div v-if="selectedTag" class="flex flex-col gap-3 flex-grow animate-in fade-in slide-in-from-right-1 duration-200">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider select-none">{{
            t('settingsView.currentStyle')
          }}</span>
          <!-- Live tag preview badge -->
          <span
            class="rounded border uppercase tracking-wider leading-none text-[10px] px-2.5 py-1.5 font-extrabold shadow-sm transition-all duration-300"
            :class="getTagClasses(selectedTag)"
          >
            {{ selectedTag }}
          </span>
        </div>

        <!-- Color palette selector buttons -->
        <div class="flex flex-wrap items-center gap-2 mt-1">
          <!-- Reset to Auto Button -->
          <button
            @click="settingsStore.setTagColor(selectedTag, '')"
            class="flex items-center justify-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-theme-border/50 bg-theme-bg/30 text-theme-text-muted hover:text-theme-text-main hover:border-theme-border transition-all cursor-pointer"
            :class="{
              'bg-theme-primary/10 border-theme-primary text-theme-primary': !tagColors[selectedTag],
            }"
            :title="t('settingsView.tagAutoColor')"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>{{ t('settingsView.tagAutoColor') }}</span>
          </button>

          <!-- Predefined colors -->
          <button
            v-for="colorOpt in tagColorOptions"
            :key="colorOpt.id"
            @click="settingsStore.setTagColor(selectedTag, colorOpt.id)"
            class="w-7 h-7 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-115 active:scale-95 shadow-sm relative group"
            :class="[
              colorOpt.color,
              tagColors[selectedTag] === colorOpt.id
                ? 'ring-2 ring-offset-2 ring-offset-theme-card ring-theme-primary scale-110'
                : 'hover:opacity-90',
            ]"
            :title="colorOpt.id"
          >
            <!-- Show a small check if selected -->
            <Check v-if="tagColors[selectedTag] === colorOpt.id" class="w-3.5 h-3.5 text-white drop-shadow-md shrink-0" />
            <!-- Micro-tooltip on hover -->
            <span
              class="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/85 text-white text-[9px] rounded font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity uppercase tracking-wider duration-150 z-50 whitespace-nowrap"
            >
              {{ colorOpt.id }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
