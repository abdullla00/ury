<template>
  <div class="relative" ref="root">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-12"
      @click="open = !open"
    >
      <span>{{ production }}</span>
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div
      v-if="open"
      class="absolute left-0 top-full z-30 mt-1 min-w-[10rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      <button
        v-for="unit in units"
        :key="unit.name"
        type="button"
        class="block w-full min-h-12 px-4 py-2 text-left text-sm hover:bg-gray-50"
        :class="unit.production === production ? 'font-semibold text-primary-700' : 'text-gray-700'"
        @click="selectUnit(unit.production)"
      >
        {{ unit.production }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";

const props = defineProps({
  production: String,
  units: { type: Array, default: () => [] },
});

const router = useRouter();
const open = ref(false);
const root = ref(null);

function selectUnit(unit) {
  open.value = false;
  if (unit === props.production) return;
  router.push(`/${encodeURIComponent(unit)}`);
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("click", onClickOutside));
onUnmounted(() => document.removeEventListener("click", onClickOutside));
</script>
