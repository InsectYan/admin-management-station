<template>
  <PageShell title="执行中心" table-layout>
    <el-tabs v-model="tab" @tab-change="onTabChange">
      <el-tab-pane label="进行中" name="running">
        <el-table v-loading="activeLoading" :data="activeRuns" stripe border size="small">
          <el-table-column prop="id" label="Run ID" width="80" />
          <el-table-column prop="item_id" label="用例编码" width="140" />
          <el-table-column prop="scheme_id" label="方案" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column label="进度" min-width="180">
            <template #default="{ row }">
              <el-progress
                :percentage="rowProgress(row).percent"
                :status="rowProgress(row).status"
                :stroke-width="10"
              />
              <span class="progress-text">{{ rowProgress(row).label }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link @click="router.push(`/fitness/execution/runs/${row.id}`)">控制台</el-button>
              <el-button link type="warning" @click="cancelRun(row.id)">取消</el-button>
            </template>
          </el-table-column>
        </el-table>
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
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { cancelFtRun, fetchFtRuns, streamFtRun } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const tab = ref('history');
const loading = ref(false);
const activeLoading = ref(false);
const runs = ref([]);
const activeRuns = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
/** @type {Map<number, object>} */
const liveMap = ref(new Map());
/** @type {Map<number, EventSource>} */
const streamMap = new Map();
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

const runColumns = [
  { prop: 'id', label: 'Run ID', width: 80 },
  { prop: 'item_id', label: '用例编码', width: 140 },
  { prop: 'scheme_id', label: '方案编码', width: 100 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'verdict', label: '判定', width: 80 },
];

function rowProgress(row) {
  const live = liveMap.value.get(row.id);
  const p = live?.percent ?? row.progress?.percent ?? 0;
  const rate = live?.pass_rate ?? row.progress?.pass_rate;
  const completed = live?.completed;
  const totalCount = live?.total;
  let label = row.status;
  if (completed && totalCount) label = `${completed}/${totalCount}`;
  else if (rate != null) label = `达标率 ${rate}%`;
  return {
    percent: Number.isFinite(Number(p)) ? Number(p) : 0,
    label,
    status: row.status === 'failed' ? 'exception' : undefined,
  };
}

function closeStreams() {
  for (const es of streamMap.values()) es.close();
  streamMap.clear();
}

function attachStreams(rows) {
  closeStreams();
  for (const row of rows) {
    const es = streamFtRun(row.id, payload => {
      liveMap.value.set(row.id, payload);
      liveMap.value = new Map(liveMap.value);
      if ([ 'success', 'failed', 'cancelled' ].includes(payload.status)) {
        loadActive();
      }
    });
    streamMap.set(row.id, es);
  }
}

async function loadHistory() {
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

async function loadActive() {
  activeLoading.value = true;
  try {
    const [ pending, running ] = await Promise.all([
      fetchFtRuns({ status: 'pending', pageSize: 50 }),
      fetchFtRuns({ status: 'running', pageSize: 50 }),
    ]);
    activeRuns.value = [ ...(pending.list || []), ...(running.list || []) ];
    if (tab.value === 'running') attachStreams(activeRuns.value);
  } finally {
    activeLoading.value = false;
  }
}

async function cancelRun(runId) {
  await cancelFtRun(runId);
  ElMessage.success('已取消');
  await loadActive();
}

function onTabChange(name) {
  if (name === 'running') {
    loadActive();
    pollTimer = setInterval(loadActive, 8000);
  } else {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    closeStreams();
    loadHistory();
  }
}

onMounted(loadHistory);
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  closeStreams();
});
</script>

<style scoped>
.progress-text {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
