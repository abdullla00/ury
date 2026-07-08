<template>
  <div class="relative" ref="root">
    <button
      type="button"
      class="flex min-h-12 min-w-12 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
      aria-label="Card menu"
      @click.stop="open = !open"
    >
      ⋮
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      <button
        v-if="enableReprint"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
        @click.stop="onReprint"
      >
        {{ t("reprint_kot") }}
      </button>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
        @click.stop="onCopy"
      >
        {{ t("copy_order") }}
      </button>
      <button
        v-if="kot.order_status !== 'Served'"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
        @click.stop="onJumpCompleted"
      >
        {{ t("jump_completed") }}
      </button>
      <button
        v-if="kot.order_status !== 'Served' && kot.order_status !== 'Ready'"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
        @click.stop="onMarkReady"
      >
        {{ t("mark_ready") }}
      </button>
      <button
        v-if="kot.order_status !== 'Served'"
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
        @click.stop="onPin"
      >
        {{ pinned ? t("unpin") : t("pin_top") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { t } from "../utils/mosaic-i18n.js";
import { getOrderDisplayNo } from "../utils/kot-format.js";

const props = defineProps({
  kot: { type: Object, required: true },
  dailyOrderNumber: Boolean,
  enableReprint: Boolean,
  pinned: Boolean,
});

const emit = defineEmits(["reprint", "copy", "jump-completed", "pin", "mark-ready"]);
const open = ref(false);
const root = ref(null);

function close() {
  open.value = false;
}

function onReprint() {
  close();
  emit("reprint", props.kot);
}

function onCopy() {
  close();
  const orderNo = getOrderDisplayNo(props.kot, props.dailyOrderNumber);
  navigator.clipboard?.writeText(String(orderNo));
  emit("copy", orderNo);
}

function onJumpCompleted() {
  close();
  emit("jump-completed");
}

function onPin() {
  close();
  emit("pin", props.kot);
}

function onMarkReady() {
  close();
  emit("mark-ready", props.kot);
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) close();
}

onMounted(() => document.addEventListener("click", onClickOutside));
onUnmounted(() => document.removeEventListener("click", onClickOutside));
</script>
