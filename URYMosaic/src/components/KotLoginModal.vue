<template>
  <div
    v-if="show"
    class="fixed inset-0 z-10 flex items-center justify-center bg-black/20 p-4"
  >
    <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <p class="flex items-center gap-2 text-xl font-semibold text-gray-900">
        <span class="inline-block h-3 w-3 rounded-full bg-red-500" />
        Not Permitted
      </p>
      <hr class="my-4 border-gray-200" />
      <p class="text-gray-600">{{ t("login_required") }}</p>
      <button
        type="button"
        class="mt-6 min-h-12 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
        @click="$emit('login')"
      >
        {{ t("login") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { t } from "../utils/mosaic-i18n.js";

defineProps({ show: Boolean });
defineEmits(["login"]);
</script>
