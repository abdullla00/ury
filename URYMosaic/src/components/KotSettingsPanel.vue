<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex justify-end bg-black/30"
      @click.self="$emit('close')"
    >
      <aside class="flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h2 class="text-lg font-semibold text-gray-900">{{ t("settings") }}</h2>
          <button
            type="button"
            class="min-h-12 min-w-12 rounded-lg text-gray-500 hover:bg-gray-100"
            @click="$emit('close')"
          >
            ✕
          </button>
        </div>
        <div class="flex-1 space-y-6 overflow-y-auto p-4">
          <label class="flex min-h-12 items-center justify-between gap-3">
            <span class="text-sm text-gray-700">{{ t("wall_default") }}</span>
            <input v-model="localWallDefault" type="checkbox" class="h-5 w-5" />
          </label>
          <label class="flex min-h-12 items-center justify-between gap-3">
            <span class="text-sm text-gray-700">{{ t("show_station_switcher") }}</span>
            <input v-model="localStationSwitcher" type="checkbox" class="h-5 w-5" />
          </label>
          <div>
            <p class="mb-2 text-sm text-gray-700">{{ t("font_size") }}</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="min-h-12 flex-1 rounded-lg border px-3 text-sm"
                :class="localFontSize === 'normal' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'"
                @click="localFontSize = 'normal'"
              >
                {{ t("font_normal") }}
              </button>
              <button
                type="button"
                class="min-h-12 flex-1 rounded-lg border px-3 text-sm"
                :class="localFontSize === 'large' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'"
                @click="localFontSize = 'large'"
              >
                {{ t("font_large") }}
              </button>
            </div>
          </div>
          <div>
            <p class="mb-2 text-sm text-gray-700">{{ t("language") }}</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="opt in localeOptions"
                :key="opt.id"
                type="button"
                class="min-h-12 rounded-lg border px-2 text-sm"
                :class="localLocale === opt.id ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'"
                @click="localLocale = opt.id"
              >
                {{ t(opt.labelKey) }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="min-h-12 w-full rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50"
            @click="$emit('sound-test')"
          >
            {{ t("sound_test") }}
          </button>
        </div>
        <div class="border-t border-gray-200 p-4">
          <button
            type="button"
            class="min-h-12 w-full rounded-lg bg-primary-600 px-4 font-medium text-white hover:bg-primary-700"
            @click="save"
          >
            {{ t("close") }}
          </button>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from "vue";
import { t, getMosaicLocale, setMosaicLocale } from "../utils/mosaic-i18n.js";
import { getBoolSetting, getSetting, setBoolSetting, setSetting, isStationSwitcherEnabled } from "../utils/mosaic-settings.js";

const localeOptions = [
  { id: "en", labelKey: "lang_en" },
  { id: "ar", labelKey: "lang_ar" },
  { id: "fr", labelKey: "lang_fr" },
];

const props = defineProps({ show: Boolean });
const emit = defineEmits(["close", "save", "sound-test"]);

const localWallDefault = ref(getBoolSetting("wallDefault", false));
const localStationSwitcher = ref(isStationSwitcherEnabled());
const localFontSize = ref(getSetting("fontSize", "normal"));
const localLocale = ref(getMosaicLocale());
const initialLocale = ref(getMosaicLocale());

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    localWallDefault.value = getBoolSetting("wallDefault", false);
    localStationSwitcher.value = isStationSwitcherEnabled();
    localFontSize.value = getSetting("fontSize", "normal");
    localLocale.value = getMosaicLocale();
    initialLocale.value = getMosaicLocale();
  },
);

function save() {
  setBoolSetting("wallDefault", localWallDefault.value);
  setBoolSetting("stationSwitcher", localStationSwitcher.value);
  setSetting("fontSize", localFontSize.value);
  const localeChanged = localLocale.value !== initialLocale.value;
  if (localeChanged) {
    setMosaicLocale(localLocale.value);
  }
  emit("save", {
    wallDefault: localWallDefault.value,
    stationSwitcher: localStationSwitcher.value,
    fontSize: localFontSize.value,
    locale: localLocale.value,
  });
  emit("close");
  if (localeChanged) {
    window.location.reload();
  }
}
</script>
