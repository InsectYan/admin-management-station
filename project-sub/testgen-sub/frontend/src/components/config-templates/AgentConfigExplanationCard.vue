<template>
  <el-card v-if="explanation" shadow="never" class="agent-explain-card">
    <template #header>
      <span>Agent 配置说明</span>
      <el-tag size="small" type="success" style="margin-left:8px">已生成</el-tag>
    </template>
    <p v-if="explanation.summary" class="summary">{{ explanation.summary }}</p>
    <el-descriptions v-if="explanation.reasons?.length" :column="1" border size="small" style="margin-top:12px">
      <el-descriptions-item
        v-for="(r, i) in explanation.reasons"
        :key="i"
        :label="r.field || `项 ${i + 1}`"
      >
        {{ r.reason }}
        <el-tag v-if="r.editable !== false" size="small" type="info" style="margin-left:6px">可手动调整</el-tag>
        <el-tag v-else size="small" type="warning" style="margin-left:6px">建议保持</el-tag>
      </el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-if="explanation.missing_prerequisites?.length"
      type="warning"
      :closable="false"
      show-icon
      style="margin-top:12px"
      title="缺少的前置内容"
    >
      <ul class="missing-list">
        <li v-for="(m, i) in explanation.missing_prerequisites" :key="i">{{ m }}</li>
      </ul>
    </el-alert>
    <p v-if="explanation.adjustable_hint" class="hint">{{ explanation.adjustable_hint }}</p>
  </el-card>
</template>

<script setup>
defineProps({
  explanation: { type: Object, default: null },
});
</script>

<style scoped>
.agent-explain-card { margin-top: 16px; }
.summary { margin: 0; line-height: 1.6; color: #303133; }
.hint { margin: 12px 0 0; color: #909399; font-size: 13px; }
.missing-list { margin: 4px 0 0; padding-left: 18px; }
</style>
