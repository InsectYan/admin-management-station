<template>
  <nav class="novel-detail-tabs" aria-label="详情模块">
    <button
      v-for="item in tabs"
      :key="item.step"
      type="button"
      class="novel-detail-tabs__item"
      :class="{
        'is-active': item.step === currentTab,
        'is-filled': filledMap[item.key],
      }"
      @click="$emit('select', item.step)"
    >
      <span class="novel-detail-tabs__index">{{ item.step }}</span>
      <span class="novel-detail-tabs__label">{{ item.title }}</span>
      <span v-if="filledMap[item.key]" class="novel-detail-tabs__dot" aria-hidden="true" />
    </button>
  </nav>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  currentTab: { type: Number, required: true },
  filledMap: { type: Object, default: () => ({}) },
});

defineEmits(['select']);
</script>

<style scoped>
.novel-detail-tabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--novel-radius-base, 10px);
  background: var(--novel-color-mist);
  border: var(--novel-border-subtle);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
}

.novel-detail-tabs__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  border-radius: var(--novel-radius-sm, 6px);
  background: transparent;
  color: var(--novel-color-text-secondary, #5c6b62);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.novel-detail-tabs__item:hover {
  background: var(--novel-color-surface, #fbfcfa);
}

.novel-detail-tabs__item.is-active {
  background: var(--novel-color-surface-elevated, #fff);
  border-color: rgba(61, 107, 79, 0.32);
  color: var(--novel-color-deep, #2a3a30);
  box-shadow: var(--novel-shadow-soft, 0 1px 2px rgba(42, 58, 48, 0.05));
}

.novel-detail-tabs__item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--novel-color-primary, #3d6b4f);
}

.novel-detail-tabs__index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  background: rgba(61, 107, 79, 0.1);
  color: inherit;
}

.is-active .novel-detail-tabs__index {
  background: rgba(47, 138, 91, 0.22);
  color: var(--novel-color-deep);
}

.novel-detail-tabs__label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}

.novel-detail-tabs__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--novel-color-accent, #b8953a);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .novel-detail-tabs {
    flex-direction: row;
    overflow-x: auto;
    gap: 6px;
  }

  .novel-detail-tabs__item {
    flex: 1 0 auto;
    min-width: 88px;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
  }

  .novel-detail-tabs__item.is-active::before {
    left: 10px;
    right: 10px;
    top: auto;
    bottom: 0;
    width: auto;
    height: 3px;
  }

  .novel-detail-tabs__label {
    font-size: 12px;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .novel-detail-tabs__item {
    transition: none;
  }
}
</style>
