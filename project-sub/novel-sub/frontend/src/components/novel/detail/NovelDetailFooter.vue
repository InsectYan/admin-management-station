<template>
  <footer class="novel-detail-footer">
    <div class="novel-detail-footer__progress">
      <div class="novel-detail-footer__progress-head">
        <span>{{ progress.statusLabel }}</span>
        <span class="novel-detail-footer__percent">{{ progress.percent }}%</span>
      </div>
      <el-progress
        :percentage="progress.percent"
        :stroke-width="8"
        :show-text="false"
        color="#2F8A5B"
      />
    </div>
    <div class="novel-detail-footer__stats">
      <span>已写 {{ progress.chapterWritten || 0 }}/{{ progress.chapterCount || 0 }} 章</span>
      <span>{{ (progress.wordCount || 0).toLocaleString() }} 字</span>
      <span v-if="progress.wordTarget">规划 {{ progress.wordTarget.toLocaleString() }} 字</span>
    </div>
    <div class="novel-detail-footer__actions">
      <el-button :disabled="currentTab <= 1" @click="$emit('prev')">上一模块</el-button>
      <el-button :disabled="currentTab >= tabCount" type="primary" @click="$emit('next')">下一模块</el-button>
    </div>
  </footer>
</template>

<script setup>
defineProps({
  progress: { type: Object, required: true },
  currentTab: { type: Number, required: true },
  tabCount: { type: Number, default: 7 },
});

defineEmits(['prev', 'next']);
</script>

<style scoped>
.novel-detail-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 0 -20px 0;
  padding: 12px 20px 16px;
  border: none;
  border-top: var(--novel-border-subtle, 1px solid rgba(47, 138, 91, 0.12));
  border-radius: 0;
  background: var(--novel-color-surface-elevated, rgba(255, 255, 255, 0.82));
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
  flex-shrink: 0;
}

.novel-detail-footer__progress {
  flex: 1 1 220px;
  min-width: 180px;
}

.novel-detail-footer__progress-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

.novel-detail-footer__percent {
  font-weight: 700;
  color: var(--novel-color-primary, #3d6b4f);
}

.novel-detail-footer__stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--novel-color-text-muted, #8a968e);
}

.novel-detail-footer__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .novel-detail-footer__stats {
    width: 100%;
  }

  .novel-detail-footer__actions {
    margin-left: 0;
    width: 100%;
  }

  .novel-detail-footer__actions .el-button {
    flex: 1;
  }
}
</style>
