<template>
  <PageShell title="运行控制台" v-loading="loading">
    <el-descriptions v-if="run" :column="2" border>
      <el-descriptions-item label="Run ID">{{ run.id }}</el-descriptions-item>
      <el-descriptions-item label="用例">{{ run.item_id }}</el-descriptions-item>
      <el-descriptions-item label="TS">{{ run.scheme_id }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ run.status }}</el-descriptions-item>
      <el-descriptions-item label="判定">{{ run.verdict || '-' }}</el-descriptions-item>
      <el-descriptions-item label="进度">{{ progressLabel }}</el-descriptions-item>
    </el-descriptions>
    <el-progress
      v-if="run && !isTerminal"
      :percentage="progressPercent"
      :status="progressStatus"
      style="margin:16px 0"
    />
    <el-alert
      v-if="run?.progress?.error"
      type="error"
      :title="run.progress.error"
      :closable="false"
      style="margin-bottom:16px"
    />
    <el-table :data="run?.results||[]" size="small">
      <el-table-column prop="sub_index" label="#" width="50" />
      <el-table-column prop="input_summary" label="输入" min-width="160" />
      <el-table-column prop="output_summary" label="输出" min-width="160" />
      <el-table-column prop="sub_verdict" label="判定" width="80" />
    </el-table>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchFtRun, streamFtRun } from '@/services/fitnessService.js';

const TERMINAL = new Set([ 'success', 'failed', 'cancelled' ]);

const route = useRoute();
const loading = ref(false);
const run = ref(null);
const liveProgress = ref(null);
/** @type {EventSource | null} */
let es = null;

const isTerminal = computed(() => run.value && TERMINAL.has(run.value.status));

const progressPercent = computed(() => {
  const p = liveProgress.value?.percent ?? run.value?.progress?.percent;
  return Number.isFinite(Number(p)) ? Number(p) : 0;
});

const progressLabel = computed(() => {
  const phase = liveProgress.value?.phase ?? run.value?.progress?.phase ?? run.value?.status;
  const rate = liveProgress.value?.pass_rate ?? run.value?.progress?.pass_rate;
  if (rate != null) return `${phase} · 达标率 ${rate}%`;
  return phase || '-';
});

const progressStatus = computed(() => {
  if (run.value?.status === 'failed') return 'exception';
  if (run.value?.status === 'success') return 'success';
  return undefined;
});

async function reloadRun() {
  run.value = await fetchFtRun(route.params.runId);
}

function closeStream() {
  if (es) {
    es.close();
    es = null;
  }
}

function startStream() {
  closeStream();
  es = streamFtRun(route.params.runId, async payload => {
    liveProgress.value = payload;
    if (payload.status && TERMINAL.has(payload.status)) {
      await reloadRun();
      closeStream();
    } else if (payload.phase === 'done' || payload.phase === 'failed') {
      await reloadRun();
      closeStream();
    }
  });
}

onMounted(async () => {
  loading.value = true;
  try {
    await reloadRun();
    if (!isTerminal.value) startStream();
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(closeStream);
</script>
