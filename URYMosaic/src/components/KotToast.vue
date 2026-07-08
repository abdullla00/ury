<template>
  <Transition name="fade">
    <div
      v-if="message"
      class="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg"
      :class="type === 'error' ? 'bg-red-600' : 'bg-gray-900'"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  message: String,
  type: { type: String, default: "info" },
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
