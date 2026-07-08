<template>
  <div class="space-y-2">
    <div
      v-for="kotitem in visibleItems"
      :key="kotitem.name"
      class="border-b border-gray-100 pb-2 last:border-0"
    >
      <div
        class="flex min-h-12 cursor-pointer items-start justify-between gap-2"
        @click.stop="$emit('toggle-strike', kotitem)"
      >
        <div
          class="min-w-0 flex-1"
          :class="{ 'line-through text-emerald-700': kotitem.striked }"
        >
          <p class="font-semibold text-gray-900">
            <span class="tabular-nums">{{ itemQty(kotitem) }}×</span>
            {{ displayParts(kotitem).baseName }}
          </p>
          <p
            v-for="(mod, idx) in displayParts(kotitem).modifiers"
            :key="idx"
            class="ml-4 text-sm text-gray-500"
          >
            {{ mod.startsWith("+") ? mod : `+ ${mod}` }}
          </p>
          <span
            v-if="kotitem.indicate_course"
            class="ml-1 text-sm text-gray-500"
          >
            ({{ kotitem.course }})
          </span>
          <span
            v-if="isCancelType"
            class="ml-1 text-xs text-gray-500"
          >
            [was {{ kotitem.quantity }}]
          </span>
        </div>
      </div>
      <p
        v-if="kotitem.comments"
        class="mt-0.5 flex items-start gap-1 text-sm italic text-gray-600"
      >
        <span aria-hidden="true">💬</span>
        <span>"{{ kotitem.comments }}"</span>
      </p>
    </div>
    <button
      v-if="hasMore"
      type="button"
      class="min-h-12 text-sm font-medium text-primary-600 hover:text-primary-700"
      @click.stop="expanded = true"
    >
      +{{ hiddenCount }} {{ t("more_items") }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { effectiveItemQty, getItemDisplayParts } from "../utils/kot-format.js";
import { t } from "../utils/mosaic-i18n.js";

const props = defineProps({
  items: { type: Array, default: () => [] },
  kotType: String,
  maxVisible: { type: Number, default: 6 },
  wallMode: Boolean,
});

defineEmits(["toggle-strike"]);

const expanded = ref(false);
const isCancelType = computed(
  () => props.kotType === "Cancelled" || props.kotType === "Partially cancelled",
);

const visibleItems = computed(() => {
  const sorted = [...props.items];
  if (expanded.value || props.wallMode) return sorted;
  return sorted.slice(0, props.maxVisible);
});

const hasMore = computed(
  () => !expanded.value && !props.wallMode && props.items.length > props.maxVisible,
);

const hiddenCount = computed(() => props.items.length - props.maxVisible);

function itemQty(kotitem) {
  return effectiveItemQty(kotitem, props.kotType);
}

function displayParts(kotitem) {
  return getItemDisplayParts(kotitem);
}
</script>
