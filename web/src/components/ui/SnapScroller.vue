<template>
  <!-- Horizontal column scroller: free-scrolling on desktop, one full-width "page" per column (mandatory snap) on mobile -->
  <div
    class="flex gap-0 md:gap-3.5 items-stretch overflow-x-auto pb-0 md:pb-2 h-full select-none w-full scroller-thin snap-x snap-mandatory md:snap-none scroll-px-0 md:scroll-px-4"
  >
    <slot />
  </div>
</template>
