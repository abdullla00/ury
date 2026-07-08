<template>
  <header
    class="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm"
    :class="wallMode ? 'py-2' : 'py-3'"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 px-4">
      <div class="flex items-center gap-3">
        <template v-if="!wallMode">
          <img
            :src="logoUrl"
            alt="URY POS"
            class="h-8 w-auto"
            @error="onLogoError"
          />
          <div v-if="!logoError">
            <p class="text-xs text-gray-500">{{ t("kitchen_display") }}</p>
            <p class="text-sm font-semibold text-gray-900">{{ production }}</p>
          </div>
        </template>
        <template v-else>
          <p class="text-lg font-bold text-gray-900">{{ production }}</p>
          <span class="rounded-full bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-800">
            {{ t("to_cook") }}: {{ toCookCount }}
          </span>
        </template>
        <KotStationSwitcher
          v-if="showStationSwitcher && units.length > 1"
          :production="production"
          :units="units"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-if="!wallMode"
          ref="searchRef"
          v-model="localSearch"
          type="search"
          :placeholder="t('search_placeholder')"
          class="hidden min-h-12 w-40 rounded-lg border border-gray-200 px-3 py-1.5 text-sm md:block lg:w-52"
          @input="$emit('search', localSearch)"
        />
        <span class="hidden text-sm font-medium text-gray-600 sm:inline">{{ clock }}</span>
        <KotConnectionBadge :connected="connected" :using-poll="usingPoll" />
        <button
          type="button"
          class="flex min-h-12 min-w-12 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          :title="audioMuted ? t('unmute') : t('mute')"
          @click="$emit('toggle-mute')"
        >
          {{ audioMuted ? "🔇" : "🔊" }}
        </button>
        <button
          type="button"
          class="flex min-h-12 min-w-12 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          :title="t('settings')"
          @click="$emit('open-settings')"
        >
          ⚙
        </button>
        <button
          type="button"
          class="flex min-h-12 min-w-12 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          :title="t('refresh')"
          @click="$emit('refresh')"
        >
          ↻
        </button>
        <button
          type="button"
          class="min-h-12 rounded-lg px-3 py-1.5 text-sm font-medium"
          :class="wallMode ? 'bg-primary-600 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'"
          @click="$emit('toggle-wall')"
        >
          {{ wallMode ? t("exit_wall") : t("wall") }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import KotConnectionBadge from "./KotConnectionBadge.vue";
import KotStationSwitcher from "./KotStationSwitcher.vue";
import { t } from "../utils/mosaic-i18n.js";

defineProps({
  production: String,
  units: Array,
  connected: Boolean,
  usingPoll: Boolean,
  audioMuted: Boolean,
  wallMode: Boolean,
  showStationSwitcher: { type: Boolean, default: true },
  toCookCount: { type: Number, default: 0 },
});

defineEmits(["refresh", "toggle-mute", "toggle-wall", "search", "open-settings"]);

const clock = ref("");
const localSearch = ref("");
const logoError = ref(false);
const logoUrl = "/assets/ury/pos/ury_pos.png";
const searchRef = ref(null);
let clockInterval = null;

function updateClock() {
  clock.value = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function onLogoError() {
  logoError.value = true;
}

onMounted(() => {
  updateClock();
  clockInterval = setInterval(updateClock, 60000);
});

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
});

defineExpose({ focusSearch: () => searchRef.value?.focus() });
</script>
