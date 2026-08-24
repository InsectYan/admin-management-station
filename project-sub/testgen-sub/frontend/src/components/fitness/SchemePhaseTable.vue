<template>
  <el-table :data="phases" size="small" border style="width: 100%">
    <el-table-column prop="role_label" label="角色" width="100" />
    <el-table-column label="执行方案（TS）" min-width="180">
      <template #default="{ row }">
        <span :title="row.scheme_id || undefined">
          {{ formatSchemeLabel(row.scheme_id, row.scheme_name) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="判定方式（VS）" min-width="180">
      <template #default="{ row }">
        <span :title="row.validation_id || undefined">
          {{ formatValidationLabel(row.validation_id, row.validation_name) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="100">
      <template #default="{ row }">
        <FitnessStatusTag prop="status" :row="row" :value="row.status" />
      </template>
    </el-table-column>
    <el-table-column v-if="showVerdict" label="判定结果" width="90">
      <template #default="{ row }">
        <FitnessStatusTag v-if="row.verdict" prop="verdict" :row="row" />
        <span v-else>—</span>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
import FitnessStatusTag from '@/components/fitness/FitnessStatusTag.vue';
import { formatSchemeLabel, formatValidationLabel } from '@/utils/testCategoryDisplay.js';

defineProps({
  phases: { type: Array, default: () => [] },
  showVerdict: { type: Boolean, default: false },
});
</script>
