<template>
  <span class="col-header-tip">
    <span>{{ label }}</span>
    <el-tooltip v-if="tip" :content="tip" placement="top" :show-after="200">
      <el-icon class="tip-icon" aria-label="说明"><QuestionFilled /></el-icon>
    </el-tooltip>
  </span>
</template>

<script setup>
import { QuestionFilled } from '@element-plus/icons-vue';

defineProps({
  label: { type: String, required: true },
  tip: { type: String, default: '' },
});
</script>

<style scoped>
.col-header-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
}
.tip-icon {
  font-size: 14px;
  color: #909399;
  cursor: help;
}
.tip-icon:hover {
  color: var(--el-color-primary);
}
</style>
