<template>
  <div class="testgen-run-progress">
    <div class="testgen-run-progress-header">
      <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
      <span class="testgen-run-progress-pct">{{ Math.round(progress) }}%</span>
    </div>
    <el-progress :percentage="Math.min(100, Math.round(progress))" :status="progressStatus" />
    <div v-if="summary" class="testgen-run-progress-summary">
      <span>运行中 {{ summary.running }}</span>
      <span>成功 {{ summary.success }}</span>
      <span>失败 {{ summary.failed }}</span>
      <span>共 {{ summary.total }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, default: 'pending' },
  progress: { type: Number, default: 0 },
  summary: { type: Object, default: null },
});

const statusLabel = computed(() => {
  const map = {
    pending: '等待中',
    running: '运行中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[props.status] || props.status;
});

const statusTagType = computed(() => {
  const map = {
    pending: 'info',
    running: 'warning',
    success: 'success',
    failed: 'danger',
    cancelled: 'info',
  };
  return map[props.status] || 'info';
});

const progressStatus = computed(() => {
  if (props.status === 'success') return 'success';
  if (props.status === 'failed') return 'exception';
  return undefined;
});
</script>

<style scoped>
.testgen-run-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.testgen-run-progress-pct {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
.testgen-run-progress-summary {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
