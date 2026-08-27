<template>
  <nav class="novel-create-steps" aria-label="创作步骤">
    <button
      v-for="item in steps"
      :key="item.step"
      type="button"
      class="novel-create-steps__item"
      :class="{
        'is-active': item.step === currentStep,
        'is-done': item.step < currentStep,
      }"
      @click="$emit('select', item.step)"
    >
      <span class="novel-create-steps__index">{{ item.step }}</span>
      <span class="novel-create-steps__label">{{ item.title }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true },
  currentStep: { type: Number, required: true },
});

defineEmits(['select']);
</script>

<style scoped>
.novel-create-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border-radius: var(--novel-radius-base);
  background: var(--novel-gradient-steps);
  border: var(--novel-border-subtle);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
}

.novel-create-steps__item {
  flex: 1 1 120px;
  min-width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border: var(--novel-border-subtle);
  border-radius: var(--novel-radius-base);
  background: var(--novel-color-glass);
  color: var(--novel-color-text-secondary);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.novel-create-steps__item:hover {
  background: var(--novel-color-glass-hover);
}

.novel-create-steps__item.is-active,
.novel-create-steps__item.is-done {
  background: var(--novel-color-surface-elevated);
  color: var(--novel-color-deep);
  border: var(--novel-border-strong);
}

.novel-create-steps__index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background: var(--novel-color-primary-muted);
  color: inherit;
}

.is-active .novel-create-steps__index,
.is-done .novel-create-steps__index {
  background: rgba(47, 138, 91, 0.22);
  color: var(--novel-color-deep);
  border: 1px solid rgba(47, 138, 91, 0.4);
}

.novel-create-steps__label {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}

@media (max-width: 768px) {
  .novel-create-steps__item {
    flex: 1 1 calc(50% - 8px);
  }
}
</style>
