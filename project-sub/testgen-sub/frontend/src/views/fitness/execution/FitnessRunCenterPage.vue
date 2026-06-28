<template>
  <PageShell title="执行中心" table-layout>
    <el-tabs v-model="tab">
      <el-tab-pane label="进行中" name="running">
        <el-empty description="暂无进行中的运行（执行引擎未开发）" />
      </el-tab-pane>
      <el-tab-pane label="队列" name="queue">
        <el-empty description="队列为空" />
      </el-tab-pane>
      <el-tab-pane label="历史" name="history">
        <FitnessLabeledTable
          :data="runs"
          :columns="runColumns"
          :page="page"
          :page-size="pageSize"
          :total="total"
          :loading="loading"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
          @change="load"
        >
          <template #suffix>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button link @click="router.push(`/fitness/execution/runs/${row.id}`)">控制台</el-button>
              </template>
            </el-table-column>
          </template>
        </FitnessLabeledTable>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchFtRuns } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const tab = ref('history');
const loading = ref(false);
const runs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const runColumns = [
  { prop: 'id', label: 'Run ID', width: 80 },
  { prop: 'item_id', label: '用例编码', width: 140 },
  { prop: 'scheme_id', label: '方案编码', width: 100 },
  { prop: 'status', label: '状态', width: 100 },
];

async function load() {
  loading.value = true;
  try {
    const data = await fetchFtRuns({
      item_id: route.query.itemId,
      page: page.value,
      pageSize: pageSize.value,
    });
    runs.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
