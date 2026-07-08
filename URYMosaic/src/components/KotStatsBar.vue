<template>
  <div class="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
    <div class="flex items-center gap-2">
      <span class="font-medium text-gray-900">{{ t("to_cook") }}</span>
      <span class="rounded-full bg-primary-100 px-2 py-0.5 text-primary-800">{{ toCook }}</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="font-medium text-gray-900">{{ delayedLabel }}</span>
      <span
        class="rounded-full px-2 py-0.5"
        :class="delayed > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'"
      >
        {{ delayed }}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <span class="font-medium text-gray-900">{{ t("avg_wait") }}</span>
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{{ avgWait }}′</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="font-medium text-gray-900">{{ t("completed_3h") }}</span>
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{{ completed }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { t } from "../utils/mosaic-i18n.js";

const props = defineProps({
  toCook: { type: Number, default: 0 },
  delayed: { type: Number, default: 0 },
  avgWait: { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  kotAlertTime: { type: Number, default: 0 },
});

const delayedLabel = computed(() => {
  if (props.delayed > 0 && props.kotAlertTime) {
    return t("delayed_with_minutes", { minutes: props.kotAlertTime });
  }
  return t("delayed");
});
</script>
