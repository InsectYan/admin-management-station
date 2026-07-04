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
        <FitnessStatusTag prop="status" :row="row" :value="row.status" />
      </template>
    </el-table-column>
    <el-table-column v-if="showVerdict" label="判定" width="80">
      <template #default="{ row }">
        <FitnessStatusTag v-if="row.verdict" prop="verdict" :row="row" />
        <span v-else>—</span>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
import FitnessStatusTag from '@/components/fitness/FitnessStatusTag.vue';

defineProps({
  phases: { type: Array, default: () => [] },
  showVerdict: { type: Boolean, default: false },
});
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
