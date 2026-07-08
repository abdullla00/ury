<template>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <h3
          class="truncate font-bold text-gray-900"
          :class="wallMode ? 'text-2xl' : 'text-xl'"
        >
          <span v-if="tableLabel !== 'Takeaway'" class="text-sm font-medium text-gray-500">Table </span>
          {{ tableLabel }}
        </h3>
        <span v-if="ticketCount > 1" class="rounded bg-gray-200 px-1.5 text-xs font-medium text-gray-700">
          ×{{ ticketCount }}
        </span>
      </div>
      <p class="text-sm text-gray-500">
        #{{ orderNo }}
        <span v-if="kot.user"> · {{ kot.user }}</span>
        <span v-if="kot.no_of_pax"> · {{ kot.no_of_pax }} pax</span>
        <span
          v-if="showStationBadge && kot.production"
          class="ml-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
        >
          {{ kot.production }}
        </span>
      </p>
      <div v-if="kot.is_aggregator" class="mt-1 text-sm text-gray-600">
        <span>{{ kot.customer_name }}</span>
        <span v-if="kot.aggregator_id" class="ml-2 text-gray-500">ID {{ kot.aggregator_id }}</span>
      </div>
      <div v-if="typeBadge" class="mt-1">
        <span :class="typeBadge.class">{{ typeBadge.label }}</span>
      </div>
    </div>
    <div
      class="flex shrink-0 flex-col items-end"
      :class="timerClasses"
    >
      <span
        class="font-semibold tabular-nums"
        :class="wallMode ? 'text-4xl' : 'text-2xl'"
      >
        {{ elapsedLabel }}
      </span>
      <svg
        v-if="kotAlertTime"
        class="mt-1"
        :width="wallMode ? 40 : 32"
        :height="wallMode ? 40 : 32"
        viewBox="0 0 36 36"
      >
        <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" stroke-width="3" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          :stroke="kot._isDelayed ? '#dc2626' : '#3b82f6'"
          stroke-width="3"
          stroke-linecap="round"
          :stroke-dasharray="`${progress} 100`"
          transform="rotate(-90 18 18)"
        />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  kot: { type: Object, required: true },
  tableLabel: String,
  orderNo: String,
  elapsedLabel: String,
  timerClasses: String,
  typeBadge: Object,
  kotAlertTime: Number,
  wallMode: Boolean,
  ticketCount: { type: Number, default: 1 },
  showStationBadge: Boolean,
});

const progress = computed(() => {
  const alert = parseInt(props.kotAlertTime, 10) || 60;
  const elapsed = props.kot._elapsed || 0;
  return Math.min(100, (elapsed / alert) * 100);
});
</script>
