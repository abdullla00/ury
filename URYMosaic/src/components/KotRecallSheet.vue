<template>
  <Teleport to="body">
    <div
      v-if="kot"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <h2 class="text-xl font-bold text-gray-900">{{ t("recall_title") }}</h2>
        <p class="mt-2 text-gray-600">
          {{ t("recall_body") }} #{{ orderNo }}
        </p>
        <p v-if="actionError" class="mt-3 text-sm text-red-600">{{ actionError }}</p>
        <div class="mt-6 flex gap-3">
          <button
            type="button"
            class="min-h-12 flex-1 rounded-lg border border-gray-300 font-medium"
            :disabled="loading"
            @click="$emit('close')"
          >
            {{ t("cancel") }}
          </button>
          <button
            v-if="actionError"
            type="button"
            class="min-h-12 flex-1 rounded-lg border border-amber-300 bg-amber-50 font-semibold"
            :disabled="loading"
            @click="$emit('confirm', kot)"
          >
            {{ t("retry") }}
          </button>
          <button
            type="button"
            class="min-h-12 flex-1 rounded-lg bg-amber-600 font-semibold text-white hover:bg-amber-700"
            :disabled="loading"
            @click="$emit('confirm', kot)"
          >
            {{ loading ? "…" : t("recall") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";
import { getOrderDisplayNo } from "../utils/kot-format.js";
import { t } from "../utils/mosaic-i18n.js";

const props = defineProps({
  kot: Object,
  dailyOrderNumber: Boolean,
  loading: Boolean,
  actionError: String,
});

defineEmits(["close", "confirm"]);

const orderNo = computed(() =>
  props.kot ? getOrderDisplayNo(props.kot, props.dailyOrderNumber) : "",
);
</script>
