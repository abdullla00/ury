<template>
  <div
    v-if="show"
    class="fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-lg bg-red-50 px-4 py-2 text-center text-lg font-semibold text-red-600 shadow"
    role="alert"
  >
    {{ t("audio_gate") }}
  </div>
</template>

<script setup>
import { t } from "../utils/mosaic-i18n.js";

defineProps({ show: Boolean });
</script>
