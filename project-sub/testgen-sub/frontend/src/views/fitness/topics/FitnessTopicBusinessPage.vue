<template>
  <PageShell title="业务专题">
    <p class="topic-desc">PRD 目标覆盖率与业务维度资产概览。</p>
    <el-table v-loading="loading" :data="rows" size="small" border>
      <el-table-column prop="prd_goal_id" label="PRD 目标" width="140" />
      <el-table-column prop="goal_name" label="名称" min-width="160" />
      <el-table-column prop="linked_item_count" label="关联用例" width="100" />
      <el-table-column prop="linked_p0_count" label="关联 P0" width="100" />
      <el-table-column prop="coverage_note" label="覆盖状态" width="100">
        <template #default="{ row }">
          <FitnessStatusTag prop="coverage_note" :row="row" />
        </template>
      </el-table-column>
    </el-table>
    <el-button type="primary" link style="margin-top:12px" @click="router.push('/fitness/insights/metrics/prd-goals')">
      查看 PRD 指标
    </el-button>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import FitnessStatusTag from '@/components/fitness/FitnessStatusTag.vue';
import { fetchView } from '@/services/fitnessService.js';

const router = useRouter();
const loading = ref(false);
const rows = ref([]);

onMounted(async () => {
  loading.value = true;
  try {
    const data = await fetchView('v_metric_prd_goal_coverage', { pageSize: 50 });
    rows.value = data.list || [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.topic-desc {
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}
</style>
