<template>
  <nav class="cartoon-steps" aria-label="漫剧流程">
    <button
      v-for="item in steps"
      :key="item.step"
      type="button"
      class="cartoon-steps__item"
      :class="{ 'is-active': item.step === current, 'is-done': item.step < current }"
      @click="$emit('select', item.step)"
    >
      <span class="cartoon-steps__index">{{ item.step }}</span>
      <span class="cartoon-steps__label">{{ item.title }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, required: true },
});
defineEmits(['select']);
</script>
