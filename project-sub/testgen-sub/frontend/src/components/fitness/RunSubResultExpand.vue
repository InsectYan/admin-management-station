<template>
  <div class="run-sub-expand">
    <el-descriptions :column="2" size="small" border>
      <el-descriptions-item label="Runner">{{ panel.runner }}</el-descriptions-item>
      <el-descriptions-item v-if="panel.exitCode != null" label="退出码">{{ panel.exitCode }}</el-descriptions-item>
      <el-descriptions-item v-if="panel.durationMs != null" label="耗时">{{ panel.durationMs }} ms</el-descriptions-item>
      <el-descriptions-item v-if="panel.httpStatus != null" label="HTTP">{{ panel.httpStatus }}</el-descriptions-item>
      <el-descriptions-item v-if="panel.cwd" label="cwd" :span="2">{{ panel.cwd }}</el-descriptions-item>
    </el-descriptions>
    <pre v-if="panel.command" class="log-block">{{ panel.command }}</pre>
    <pre v-if="panel.stderr" class="log-block log-block--stderr">{{ formatLog(panel.stderr) }}</pre>
    <pre v-if="panel.stdout" class="log-block">{{ formatLog(panel.stdout) }}</pre>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { buildRunFailurePanel, truncateLogText } from '@/utils/runResultDetail.js';

const props = defineProps({
  row: { type: Object, required: true },
});

const panel = computed(() => buildRunFailurePanel(props.row));

function formatLog(text) {
  return truncateLogText(text);
}
</script>

<style scoped>
.run-sub-expand {
  padding: 8px 12px 12px;
}
.log-block {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.45;
  overflow: auto;
  max-height: 280px;
  white-space: pre-wrap;
  word-break: break-word;
}
.log-block--stderr {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
