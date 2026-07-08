<template>
  <Teleport to="body">
    <div
      v-if="kot"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      @click.self="$emit('close')"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        role="dialog"
      >
        <h2 class="text-xl font-bold text-gray-900">
          {{ isCancel ? t("confirm_cancel") : t("mark_served") }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {{ tableLabel }} · #{{ orderNo }}
        </p>

        <div
          v-if="kot.allergy_note"
          class="mt-4 rounded-lg border border-red-400 bg-red-50 px-3 py-2"
        >
          <p class="text-xs font-semibold uppercase text-red-800">{{ t("allergy_note") }}</p>
          <p class="mt-1 font-semibold text-red-900">{{ kot.allergy_note }}</p>
        </div>

        <div
          v-if="kot.comments"
          class="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
        >
          <p class="text-xs font-semibold uppercase text-amber-800">{{ t("order_note") }}</p>
          <p class="mt-1 text-amber-900">{{ kot.comments }}</p>
        </div>

        <ul class="mt-4 space-y-3 text-sm">
          <li
            v-for="item in items"
            :key="item.name"
            class="border-b border-gray-100 pb-2 last:border-0"
          >
            <p class="font-medium text-gray-900">
              <span class="tabular-nums">{{ itemQty(item) }}×</span>
              {{ displayParts(item).baseName }}
            </p>
            <p
              v-for="(mod, idx) in displayParts(item).modifiers"
              :key="idx"
              class="ml-4 text-gray-500"
            >
              {{ mod.startsWith("+") ? mod : `+ ${mod}` }}
            </p>
            <p
              v-if="item.comments"
              class="mt-1 flex items-start gap-1 italic text-gray-600"
            >
              <span aria-hidden="true">💬</span>
              <span>"{{ item.comments }}"</span>
            </p>
          </li>
        </ul>

        <p v-if="actionError" class="mt-3 text-sm text-red-600">{{ actionError }}</p>

        <div class="mt-6 flex gap-3">
          <button
            type="button"
            class="min-h-12 flex-1 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
            :disabled="loading"
            @click="$emit('close')"
          >
            {{ t("cancel") }}
          </button>
          <button
            v-if="actionError"
            type="button"
            class="min-h-12 flex-1 rounded-lg border border-amber-300 bg-amber-50 font-semibold text-amber-900"
            :disabled="loading"
            @click="$emit('confirm', kot)"
          >
            {{ t("retry") }}
          </button>
          <button
            type="button"
            class="min-h-12 flex-1 rounded-lg font-semibold text-white"
            :class="isCancel ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'"
            :disabled="loading"
            @click="$emit('confirm', kot)"
          >
            {{ loading ? "…" : isCancel ? t("confirm_cancel") : t("mark_served") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";
import {
  getTableLabel,
  getOrderDisplayNo,
  sortKotItems,
  effectiveItemQty,
  getItemDisplayParts,
} from "../utils/kot-format.js";
import { t } from "../utils/mosaic-i18n.js";

const props = defineProps({
  kot: Object,
  dailyOrderNumber: Boolean,
  loading: Boolean,
  actionError: String,
});

defineEmits(["close", "confirm"]);

const isCancel = computed(
  () =>
    props.kot?.type === "Cancelled" ||
    props.kot?.type === "Partially cancelled",
);

const tableLabel = computed(() => (props.kot ? getTableLabel(props.kot) : ""));
const orderNo = computed(() =>
  props.kot ? getOrderDisplayNo(props.kot, props.dailyOrderNumber) : "",
);
const items = computed(() =>
  props.kot ? sortKotItems(props.kot.kot_items) : [],
);

function itemQty(item) {
  return effectiveItemQty(item, props.kot?.type);
}

function displayParts(item) {
  return getItemDisplayParts(item);
}
</script>
