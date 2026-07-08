<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    :class="
      connected && !usingPoll
        ? 'bg-emerald-50 text-emerald-800'
        : 'bg-amber-50 text-amber-800'
    "
  >
    <span
      class="h-2 w-2 rounded-full"
      :class="connected && !usingPoll ? 'bg-emerald-500' : 'bg-amber-500'"
    />
    {{ connected && !usingPoll ? t("live") : t("polling") }}
  </span>
</template>

<script setup>
import { t } from "../utils/mosaic-i18n.js";

defineProps({
  connected: Boolean,
  usingPoll: Boolean,
});
</script>
