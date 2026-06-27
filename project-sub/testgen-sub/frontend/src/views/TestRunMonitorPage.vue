<template>
  <PageShell title="执行监控">
    <template #extra>
      <el-button
        v-if="!store.isTerminal"
        type="danger"
        plain
        @click="handleCancel"
      >
        取消执行
      </el-button>
      <el-button @click="goResults">查看结果</el-button>
    </template>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>状态概览</template>
          <RunProgressPanel
            :status="store.status"
            :progress="store.progress"
            :summary="store.summary"
          />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>性能指标</template>
          <RealtimeMetricsChart
            :metrics="store.metrics"
            :field="store.mode === 'performance' ? 'responseTime' : 'responseTime'"
          />
        </el-card>
      </el-col>
      <el-col :span="12" style="margin-top: 16px">
        <el-card shadow="never">
          <template #header>实时日志</template>
          <el-scrollbar height="200px">
            <pre class="testgen-run-log">{{ store.logTail || '暂无日志' }}</pre>
          </el-scrollbar>
        </el-card>
      </el-col>
      <el-col :span="12" style="margin-top: 16px">
        <el-card shadow="never">
          <template #header>任务列表</template>
          <el-table :data="store.items" size="small" border empty-text="暂无任务">
            <el-table-column prop="id" label="Run ID" width="80" />
            <el-table-column label="用例" min-width="140">
              <template #default="{ row }">
                {{ row.test_case?.title || row.case_id }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90" />
            <el-table-column prop="progress" label="进度" width="80">
              <template #default="{ row }">{{ Math.round(row.progress || 0) }}%</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </PageShell>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import RunProgressPanel from '../components/RunProgressPanel.vue';
import RealtimeMetricsChart from '../components/RealtimeMetricsChart.vue';
import { useTestRunProgress } from '../composables/useTestRunProgress.js';

const route = useRoute();
const router = useRouter();
const runId = computed(() => route.params.runId);
const { store } = useTestRunProgress(runId);

async function handleCancel() {
  try {
    await ElMessageBox.confirm('确认取消当前执行？', '取消执行', { type: 'warning' });
    await store.cancel();
    ElMessage.success('已取消');
  } catch {
    /* dismissed */
  }
}

function goResults() {
  router.push({ name: 'test-run-results', params: { runId: runId.value } });
}
</script>

<style scoped>
.testgen-run-log {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
