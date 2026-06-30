<template>
  <div v-loading="loading">
    <FitnessLabeledTable
      :data="runs"
      :columns="runColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="loadHistory"
    >
      <template #suffix>
        <el-table-column label="达标率" width="90">
          <template #default="{ row }">
            {{ row.progress?.pass_rate != null ? `${row.progress.pass_rate}%` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link @click="router.push(`/fitness/execution/runs/${row.id}`)">控制台</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchFtRuns } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const runs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const runColumns = [
  { prop: 'id', label: 'Run ID', width: 80 },
  { prop: 'scheme_id', label: '方案编码', width: 100 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'verdict', label: '判定', width: 80 },
  { prop: 'created_at', label: '开始时间', minWidth: 160 },
];

async function loadHistory() {
  loading.value = true;
  try {
    const data = await fetchFtRuns({
      item_id: route.params.itemId,
      page: page.value,
      pageSize: pageSize.value,
    });
    runs.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.itemId, () => {
  page.value = 1;
  loadHistory();
});

onMounted(loadHistory);
</script>
