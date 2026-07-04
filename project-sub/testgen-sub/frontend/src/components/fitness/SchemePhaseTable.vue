<template>
  <el-table :data="phases" size="small" border style="width: 100%">
    <el-table-column prop="role_label" label="角色" width="88" />
    <el-table-column label="方案" min-width="180">
      <template #default="{ row }">
        <div class="code-name-cell">
          <code>{{ row.scheme_id || '—' }}</code>
          <span class="name">{{ row.scheme_name || '—' }}</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="验证" min-width="180">
      <template #default="{ row }">
        <div class="code-name-cell">
          <code>{{ row.validation_id || '—' }}</code>
          <span class="name">{{ row.validation_name || '—' }}</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="100">
      <template #default="{ row }">
        <el-tag :type="statusTagType(row.status)" size="small">
          {{ row.status_label || row.status || '—' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column v-if="showVerdict" label="判定" width="80">
      <template #default="{ row }">
        <el-tag v-if="row.verdict" :type="row.verdict === 'pass' ? 'success' : 'danger'" size="small">
          {{ row.verdict }}
        </el-tag>
        <span v-else>—</span>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
defineProps({
  phases: { type: Array, default: () => [] },
  showVerdict: { type: Boolean, default: false },
});

const STATUS_TAG = {
  pending: 'info',
  running: 'warning',
  success: 'success',
  failed: 'danger',
  cancelled: 'info',
};

function statusTagType(status) {
  return STATUS_TAG[status] || 'info';
}
</script>

<style scoped>
.code-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}
.code-name-cell code {
  font-size: 12px;
  color: var(--el-text-color-primary);
}
.code-name-cell .name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
