<template>
  <PageShell title="运行控制台" v-loading="loading">
    <el-descriptions v-if="run" :column="2" border>
      <el-descriptions-item label="Run ID">{{ run.id }}</el-descriptions-item>
      <el-descriptions-item label="用例">{{ run.item_id }}</el-descriptions-item>
      <el-descriptions-item label="TS">{{ run.scheme_id }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ run.status }}</el-descriptions-item>
      <el-descriptions-item label="判定">{{ run.verdict || '-' }}</el-descriptions-item>
    </el-descriptions>
    <el-alert type="info" :closable="false" style="margin:16px 0">
      统一控制台壳层已就绪；实时进度与子结果依赖执行引擎（见 nodes.md）。
    </el-alert>
    <el-table :data="run?.results||[]" size="small">
      <el-table-column prop="sub_index" label="#" width="50" />
      <el-table-column prop="input_summary" label="输入" />
      <el-table-column prop="output_summary" label="输出" />
      <el-table-column prop="sub_verdict" label="判定" width="80" />
    </el-table>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchFtRun } from '@/services/fitnessService.js';

const route = useRoute();
const loading = ref(false);
const run = ref(null);

onMounted(async () => {
  loading.value = true;
  try {
    run.value = await fetchFtRun(route.params.runId);
  } finally {
    loading.value = false;
  }
});
</script>
