<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <p class="text-lg font-medium text-gray-900">{{ steps[step] }}</p>
        <p class="mt-2 text-sm text-gray-500">{{ step + 1 }} / {{ steps.length }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button
            v-if="step > 0"
            type="button"
            class="min-h-12 rounded-lg border border-gray-300 px-4"
            @click="step -= 1"
          >
            {{ t("cancel") }}
          </button>
          <button
            type="button"
            class="min-h-12 rounded-lg bg-primary-600 px-4 font-medium text-white"
            @click="next"
          >
            {{ step < steps.length - 1 ? t("next") : t("got_it") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from "vue";
import { t } from "../utils/mosaic-i18n.js";
import { setBoolSetting } from "../utils/mosaic-settings.js";

defineProps({ show: Boolean });
const emit = defineEmits(["done"]);

const step = ref(0);
const steps = [t("onboarding_step1"), t("onboarding_step2"), t("onboarding_step3")];

function next() {
  if (step.value < steps.length - 1) {
    step.value += 1;
    return;
  }
  setBoolSetting("onboardingDone", true);
  emit("done");
}
</script>
