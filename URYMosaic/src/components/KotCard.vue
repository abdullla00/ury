<template>
  <div
    class="kot-card-enter rounded-xl shadow-md transition-all duration-300"
    :class="cardClassList"
    @click="onCardClick"
    @dblclick="onDoubleClick"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchCancel"
  >
    <div class="relative p-4" :class="wallMode ? 'min-h-[360px]' : 'min-h-[200px]'">
      <div class="absolute right-2 top-2">
        <KotCardMenu
          :kot="kot"
          :daily-order-number="dailyOrderNumber"
          :enable-reprint="enableReprint"
          :pinned="pinned"
          @reprint="$emit('reprint', kot)"
          @copy="$emit('copy-order', $event)"
          @jump-completed="$emit('jump-completed')"
          @pin="$emit('pin', kot)"
          @mark-ready="$emit('mark-ready', kot)"
        />
      </div>

      <KotCardHeader
        :kot="kot"
        :table-label="tableLabel"
        :order-no="orderNo"
        :elapsed-label="elapsedLabel"
        :timer-classes="timerClasses"
        :type-badge="typeBadge"
        :kot-alert-time="kotAlertTime"
        :wall-mode="wallMode"
        :ticket-count="ticketCount"
        :show-station-badge="showStationBadge"
      />

      <div
        v-if="kot.allergy_note"
        class="mt-3 rounded-lg border border-red-400 bg-red-50 px-3 py-2"
        :class="wallMode ? 'text-base' : 'text-sm'"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-red-800">{{ t("allergy_note") }}</p>
        <p class="mt-0.5 font-semibold text-red-900">{{ kot.allergy_note }}</p>
      </div>

      <div
        v-if="kot.comments"
        class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
        :class="wallMode ? 'text-base' : 'text-sm'"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-amber-800">{{ t("order_note") }}</p>
        <p class="mt-0.5 font-medium text-amber-900">{{ kot.comments }}</p>
      </div>

      <div class="mt-3">
        <KotCardItems
          :items="sortedItems"
          :kot-type="kot.type"
          :wall-mode="wallMode"
          @toggle-strike="toggleStrike"
        />
      </div>

      <div
        v-if="kot.order_status === 'Served' && kot.production_time"
        class="mt-3 text-sm text-gray-500"
      >
        {{ t("served_in") }} {{ Math.round(kot.production_time) }}′
      </div>

      <div v-if="kot.order_status === 'Served'" class="mt-3">
        <button
          type="button"
          class="min-h-12 w-full rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click.stop="$emit('recall', kot)"
        >
          {{ t("recall") }}
        </button>
      </div>

      <div v-if="strikeProgress" class="mt-2 text-xs text-gray-500">
        {{ strikeProgress }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import KotCardHeader from "./KotCardHeader.vue";
import KotCardItems from "./KotCardItems.vue";
import KotCardMenu from "./KotCardMenu.vue";
import { getTableLabel, getOrderDisplayNo, sortKotItems } from "../utils/kot-format.js";
import { useKotCardStyle } from "../composables/useKotCardStyle.js";
import { t } from "../utils/mosaic-i18n.js";

const props = defineProps({
  kot: { type: Object, required: true },
  dailyOrderNumber: Boolean,
  kotAlertTime: Number,
  wallMode: Boolean,
  isNew: Boolean,
  isSelected: Boolean,
  ticketCount: { type: Number, default: 1 },
  enableReprint: Boolean,
  pinned: Boolean,
  showStationBadge: Boolean,
});

const emit = defineEmits([
  "open",
  "quick-serve",
  "recall",
  "toggle-strike",
  "reprint",
  "copy-order",
  "jump-completed",
  "pin",
  "swipe-up",
  "mark-ready",
]);

const { getCardClasses, getTimerClasses, getTypeBadge } = useKotCardStyle();
const touchStartY = ref(null);
const longPressTimer = ref(null);

function clearLongPress() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

const tableLabel = computed(() => getTableLabel(props.kot));
const orderNo = computed(() => getOrderDisplayNo(props.kot, props.dailyOrderNumber));
const elapsedLabel = computed(() => props.kot._elapsedLabel || "0′");
const cardClasses = computed(() => getCardClasses(props.kot));
const timerClasses = computed(() => getTimerClasses(props.kot, props.kotAlertTime));
const typeBadge = computed(() => getTypeBadge(props.kot));
const sortedItems = computed(() => sortKotItems(props.kot.kot_items));

const cardClassList = computed(() => [
  cardClasses.value,
  {
    "ring-4 ring-yellow-400 kot-new-highlight": props.isNew,
    "ring-2 ring-primary-500": props.isSelected,
    "border-l-amber-500 animate-pulse": props.kot.type === "Order Modified",
    "scale-[1.02]": props.wallMode,
  },
]);

const strikeProgress = computed(() => {
  const items = props.kot.kot_items || [];
  const struck = items.filter((i) => i.striked).length;
  if (!struck) return null;
  return `${struck}/${items.length} ${t("items_done")}`;
});

function onCardClick() {
  emit("open", props.kot);
}

function onDoubleClick() {
  if (
    props.wallMode &&
    props.kot.order_status !== "Served" &&
    props.kot.type !== "Cancelled" &&
    props.kot.type !== "Partially cancelled"
  ) {
    emit("quick-serve", props.kot);
  }
}

function onTouchStart(e) {
  touchStartY.value = e.changedTouches?.[0]?.clientY ?? null;
  if (props.kot.order_status === "Served") return;
  clearLongPress();
  longPressTimer.value = setTimeout(() => {
    emit("pin", props.kot);
    if (navigator.vibrate) navigator.vibrate(10);
  }, 800);
}

function onTouchEnd(e) {
  clearLongPress();
  if (touchStartY.value === null || props.wallMode) return;
  const endY = e.changedTouches?.[0]?.clientY ?? touchStartY.value;
  if (touchStartY.value - endY > 60) {
    emit("swipe-up", props.kot);
  }
  touchStartY.value = null;
}

function onTouchCancel() {
  clearLongPress();
  touchStartY.value = null;
}

function toggleStrike(kotitem) {
  kotitem.striked = !kotitem.striked;
  localStorage.setItem(
    `${props.kot.name}_${kotitem.name}_strike`,
    JSON.stringify(kotitem.striked),
  );
  emit("toggle-strike", { kot: props.kot, kotitem });
}
</script>

<style scoped>
.kot-card-enter {
  animation: kot-slide-in 0.35s ease-out;
}
.kot-new-highlight {
  animation: kot-slide-in 0.35s ease-out, kot-ring-fade 3s ease-out forwards;
}
@keyframes kot-slide-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes kot-ring-fade {
  0%,
  70% {
    box-shadow: 0 0 0 4px rgb(250 204 21);
  }
  100% {
    box-shadow: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .kot-card-enter,
  .kot-new-highlight {
    animation: none;
  }
}
</style>
