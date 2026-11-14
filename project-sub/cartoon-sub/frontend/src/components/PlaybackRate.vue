<template>
  <div class="playback-rate" role="group" aria-label="倍速">
    <span>倍速</span>
    <button
      v-for="rate in RATES"
      :key="rate"
      type="button"
      :class="{ 'is-on': modelValue === rate }"
      :aria-pressed="modelValue === rate"
      @click="emit('update:modelValue', rate)"
    >{{ rate }}</button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Number, default: 1 },
});
const emit = defineEmits([ 'update:modelValue' ]);
const RATES = [ 0.5, 0.75, 1, 1.25, 1.5, 2, 3 ];
</script>

<style scoped>
.playback-rate { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.playback-rate span { color: #5c6b62; font-size: 12px; }
.playback-rate button {
  min-width: 44px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #c5d5cb;
  border-radius: 4px;
  background: #fff;
  color: #1f3a2c;
  font-size: 12px;
  cursor: pointer;
}
.playback-rate button.is-on { border-color: #2f8a5b; background: #2f8a5b; color: #fff; }
</style>
