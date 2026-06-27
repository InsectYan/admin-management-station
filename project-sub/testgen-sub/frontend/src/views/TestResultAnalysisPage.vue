<template>
  <PageShell title="结果分析">
    <template #extra>
      <el-button @click="router.push({ name: 'test-run-monitor', params: { runId } })">
        返回监控
      </el-button>
      <el-button @click="router.push({ name: 'test-suite' })">用例列表</el-button>
    </template>

    <div v-loading="loading">
      <el-descriptions v-if="runInfo" :column="3" border size="small" style="margin-bottom: 16px">
        <el-descriptions-item label="Run ID">{{ runInfo.id }}</el-descriptions-item>
        <el-descriptions-item label="模式">{{ runInfo.mode }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag size="small">{{ runInfo.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="环境">{{ runInfo.env_config?.name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="成功/失败">
          {{ runInfo.success_requests ?? 0 }} / {{ runInfo.error_requests ?? 0 }}
        </el-descriptions-item>
      </el-descriptions>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="功能结果" name="func">
          <el-table :data="funcResults" border stripe empty-text="暂无功能测试结果">
            <el-table-column prop="run_id" label="Run" width="70" />
            <el-table-column prop="request_index" label="#" width="50" />
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="response_time_ms" label="响应(ms)" width="100" />
            <el-table-column prop="http_status_code" label="HTTP" width="80" />
            <el-table-column prop="error_message" label="错误" min-width="160" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="性能指标" name="perf">
          <RealtimeMetricsChart
            v-if="perfChartMetrics.length"
            :metrics="perfChartMetrics"
            field="tps"
            title="TPS"
          />
          <RealtimeMetricsChart
            v-if="perfChartMetrics.length"
            :metrics="perfChartMetrics"
            field="p95"
            title="P95 响应时间 (ms)"
            style="margin-top: 16px"
          />
          <el-table :data="perfResults" border stripe style="margin-top: 16px" empty-text="暂无性能数据">
            <el-table-column prop="window_start" label="窗口" min-width="160" />
            <el-table-column prop="tps" label="TPS" width="90" />
            <el-table-column prop="avg_response_time_ms" label="平均(ms)" width="100" />
            <el-table-column prop="p95_response_time_ms" label="P95(ms)" width="100" />
            <el-table-column prop="error_rate" label="错误率" width="90">
              <template #default="{ row }">
                {{ ((row.error_rate || 0) * 100).toFixed(1) }}%
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Agent 报告" name="agent">
          <PerfAnalysisPanel
            :report="perfAnalysis"
            :status="perfAnalysisStatus"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </PageShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import RealtimeMetricsChart from '../components/RealtimeMetricsChart.vue';
import PerfAnalysisPanel from '../components/PerfAnalysisPanel.vue';
import { getRunResults } from '../services/testRunService.js';

const route = useRoute();
const router = useRouter();
const runId = route.params.runId;

const loading = ref(false);
const activeTab = ref('func');
const runInfo = ref(null);
const funcResults = ref([]);
const perfResults = ref([]);
const perfAnalysis = ref(null);
const perfAnalysisStatus = ref('none');

const perfChartMetrics = computed(() =>
  perfResults.value.map((p) => ({
    tps: p.tps,
    p95: p.p95_response_time_ms,
    responseTime: p.avg_response_time_ms,
    errorRate: p.error_rate,
  })),
);

async function loadResults() {
  loading.value = true;
  try {
    const data = await getRunResults(runId);
    runInfo.value = data.run;
    funcResults.value = data.func_results || [];
    perfResults.value = data.perf_results || [];
    perfAnalysis.value = data.perf_analysis;
    perfAnalysisStatus.value = data.perf_analysis_status || 'none';
    if (runInfo.value?.mode === 'performance') {
      activeTab.value = perfResults.value.length ? 'perf' : 'agent';
    }
  } catch (err) {
    ElMessage.error(err.message || '加载结果失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadResults);
</script>
