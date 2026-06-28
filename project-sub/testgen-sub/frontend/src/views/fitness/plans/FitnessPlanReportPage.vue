<template>
  <PageShell title="测试完成报告" v-loading="loading">
    <template #extra>
      <el-button type="primary" :loading="exporting" @click="handleExport">导出 Markdown</el-button>
    </template>
    <el-table :data="resultRows" size="small">
      <el-table-column prop="item_id" label="用例" width="140" />
      <el-table-column label="结果" width="140">
        <template #default="{ row }">
          <el-select v-model="row.result_status" size="small">
            <el-option label="通过" value="passed" />
            <el-option label="失败" value="failed" />
            <el-option label="跳过" value="skipped" />
            <el-option label="待执行" value="pending" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="VS 判定" width="140">
        <template #default="{ row }">
          <el-input v-model="row.validation_result" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="备注">
        <template #default="{ row }">
          <el-input v-model="row.notes" size="small" />
        </template>
      </el-table-column>
    </el-table>
    <el-button type="primary" style="margin-top:16px" :loading="saving" @click="save">保存结果</el-button>
    <el-input v-if="reportContent" v-model="reportContent" type="textarea" :rows="12" style="margin-top:16px" readonly />
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import { exportPlanReport, fetchPlan, savePlanResults } from '@/services/fitnessService.js';

const route = useRoute();
const id = route.params.id;
const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const resultRows = ref([]);
const reportContent = ref('');

onMounted(async () => {
  loading.value = true;
  const plan = await fetchPlan(id);
  resultRows.value = (plan.items || []).map(item => {
    const existing = (plan.results || []).find(r => r.plan_item_id === item.id);
    return {
      plan_item_id: item.id,
      item_id: item.item_id,
      result_status: existing?.result_status || 'pending',
      validation_result: existing?.validation_result || '',
      notes: existing?.notes || '',
    };
  });
  loading.value = false;
});

async function save() {
  saving.value = true;
  try {
    await savePlanResults(id, resultRows.value);
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportPlanReport(id);
    reportContent.value = data.content;
    ElMessage.success('报告已生成');
  } finally {
    exporting.value = false;
  }
}
</script>
