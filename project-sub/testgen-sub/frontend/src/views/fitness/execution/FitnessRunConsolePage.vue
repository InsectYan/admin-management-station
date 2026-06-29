<template>
  <PageShell title="运行控制台" v-loading="loading">
    <el-descriptions v-if="run" :column="2" border>
      <el-descriptions-item label="Run ID">{{ run.id }}</el-descriptions-item>
      <el-descriptions-item label="用例">{{ run.item_id }}</el-descriptions-item>
      <el-descriptions-item label="TS">{{ run.scheme_id }}</el-descriptions-item>
      <el-descriptions-item label="VS">{{ run.validation_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ run.status }}</el-descriptions-item>
      <el-descriptions-item label="判定">{{ run.verdict || '-' }}</el-descriptions-item>
      <el-descriptions-item label="进度" :span="2">{{ progressLabel }}</el-descriptions-item>
    </el-descriptions>

    <el-row v-if="run" :gutter="16" style="margin:16px 0">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>达标率</template>
          <el-progress
            type="dashboard"
            :percentage="passRatePercent"
            :status="rateProgressStatus"
          />
          <p class="rate-caption">
            {{ passRatePercent }}%
            <template v-if="passkLabel"> · {{ passkLabel }}</template>
            <template v-else> / 阈值 {{ targetRatePercent }}%</template>
          </p>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <PassFailChart :pass-count="passCount" :fail-count="failCount" />
        </el-card>
      </el-col>
    </el-row>

    <el-progress
      v-if="run && !isTerminal"
      :percentage="progressPercent"
      :status="progressStatus"
      style="margin-bottom:16px"
    />
    <el-alert
      v-if="run?.progress?.error"
      type="error"
      :title="run.progress.error"
      :closable="false"
      style="margin-bottom:16px"
    />
    <el-tabs v-model="resultTab" style="margin-top:16px">
      <el-tab-pane label="子项结果" name="subs">
        <el-table :data="run?.results||[]" size="small">
          <el-table-column prop="sub_index" label="#" width="50" />
          <el-table-column prop="input_summary" label="输入" min-width="160" />
          <el-table-column prop="output_summary" label="输出" min-width="160" />
          <el-table-column prop="sub_verdict" label="判定" width="80">
            <template #default="{ row }">
              <el-tag :type="row.sub_verdict === 'pass' ? 'success' : 'danger'" size="small">
                {{ row.sub_verdict }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="Journey / 可观测" name="journey">
        <el-empty v-if="!journeyArtifacts.length" description="无可观测 artifact（TS-08 或含 journey 的子项）" />
        <el-collapse v-else>
          <el-collapse-item
            v-for="(art, i) in journeyArtifacts"
            :key="i"
            :title="`#${art.sub_index} ${art.mode || 'obs'}`"
          >
            <pre class="json-block">{{ art.json }}</pre>
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import PassFailChart from '@/components/fitness/PassFailChart.vue';
import { fetchFtRun, streamFtRun } from '@/services/fitnessService.js';

const TERMINAL = new Set([ 'success', 'failed', 'cancelled' ]);

const route = useRoute();
const loading = ref(false);
const run = ref(null);
const liveProgress = ref(null);
const resultTab = ref('subs');
/** @type {EventSource | null} */
let es = null;

const isTerminal = computed(() => run.value && TERMINAL.has(run.value.status));

const progressPercent = computed(() => {
  const p = liveProgress.value?.percent ?? run.value?.progress?.percent;
  return Number.isFinite(Number(p)) ? Number(p) : 0;
});

const passRatePercent = computed(() => {
  const rate = liveProgress.value?.pass_rate ?? run.value?.progress?.pass_rate;
  return Number.isFinite(Number(rate)) ? Number(rate) : 0;
});

const targetRatePercent = computed(() => {
  const rate = liveProgress.value?.target_rate ?? run.value?.progress?.target_rate;
  return Number.isFinite(Number(rate)) ? Number(rate) : 100;
});

const passkLabel = computed(() => {
  const p = run.value?.progress;
  if (p?.passk_M != null && p?.passk_N != null) {
    return `Pass^k M=${p.passk_M} N=${p.passk_N}`;
  }
  const thr = run.value?.validation_id === 'VS-08-PASSK';
  if (thr && run.value?.progress?.pass_count != null) {
    return `通过 ${run.value.progress.pass_count} 次`;
  }
  return '';
});

const passCount = computed(() =>
  (run.value?.results || []).filter(r => r.sub_verdict === 'pass').length,
);
const failCount = computed(() =>
  (run.value?.results || []).filter(r => r.sub_verdict === 'fail').length,
);

const journeyArtifacts = computed(() => {
  const out = [];
  for (const row of run.value?.results || []) {
    const detail = row.assertion_detail;
    const artifacts = detail?.artifacts;
    const payload = artifacts?.journey || artifacts?.obs || artifacts?.http?.body;
    if (payload) {
      out.push({
        sub_index: row.sub_index,
        mode: artifacts?.mode,
        json: JSON.stringify(payload, null, 2),
      });
    }
  }
  return out;
});

const progressLabel = computed(() => {
  const phase = liveProgress.value?.phase ?? run.value?.progress?.phase ?? run.value?.status;
  const rate = liveProgress.value?.pass_rate ?? run.value?.progress?.pass_rate;
  const completed = liveProgress.value?.completed;
  const total = liveProgress.value?.total;
  if (completed && total) return `${phase} · ${completed}/${total} · 达标率 ${rate}%`;
  if (rate != null) return `${phase} · 达标率 ${rate}%`;
  return phase || '-';
});

const progressStatus = computed(() => {
  if (run.value?.status === 'failed') return 'exception';
  if (run.value?.status === 'success') return 'success';
  return undefined;
});

const rateProgressStatus = computed(() => {
  if (isTerminal.value && run.value?.verdict === 'pass') return 'success';
  if (isTerminal.value && run.value?.verdict === 'fail') return 'exception';
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

<style scoped>
.rate-caption {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 8px;
}
.json-block {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  max-height: 320px;
}
</style>
