<template>
  <div class="flex gap-1 border-b border-gray-200 bg-white px-4">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
      :class="
        activeTab === tab.id
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      "
      @click="$emit('change', tab.id)"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="ml-1 text-gray-400">({{ tab.count }})</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
});
defineEmits(["change"]);
</script>
