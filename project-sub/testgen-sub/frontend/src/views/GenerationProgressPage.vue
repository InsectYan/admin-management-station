<template>
  <PageShell title="生成进度">
    <el-alert
      v-if="retryNotice"
      type="warning"
      :title="retryNotice"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-alert
      v-if="failedTargetsNotice"
      type="error"
      :title="failedTargetsNotice"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-alert
      v-if="store.errorMessage"
      type="error"
      :title="store.errorMessage"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-card shadow="never" class="testgen-progress-card">
      <div class="testgen-progress-summary">
        <span class="testgen-progress-label">整体进度</span>
        <span class="testgen-progress-percent">{{ store.overallPercent }}%</span>
      </div>
      <el-progress
        :percentage="store.overallPercent"
        :status="progressStatus"
        :stroke-width="22"
        striped
        striped-flow
        :duration="10"
      />
      <div v-if="currentTargetLabel" class="testgen-progress-phase">
        当前目标：{{ currentTargetLabel }}
      </div>
      <div class="testgen-progress-phase">
        当前阶段：{{ currentPhaseLabel }}
      </div>
    </el-card>

    <el-steps :active="activeStep" finish-status="success" align-center style="margin-top: 24px">
      <el-step title="需求分析" description="analyze" />
      <el-step title="生成用例" description="generate" />
      <el-step title="合规审查" description="review" />
    </el-steps>

    <el-table
      v-if="store.targetStates.length"
      :data="store.targetStates"
      size="small"
      border
      style="margin-top: 24px"
    >
      <el-table-column label="主方案" min-width="120">
        <template #default="{ row }">
          {{ row.scheme_id }} {{ row.scheme_name || '' }}
        </template>
      </el-table-column>
      <el-table-column label="主验证" min-width="120">
        <template #default="{ row }">
          {{ row.validation_id }} {{ row.validation_name || '' }}
        </template>
      </el-table-column>
      <el-table-column prop="count" label="目标条数" width="88" />
      <el-table-column label="已通过/已写入" width="110">
        <template #default="{ row }">
          <span>{{ row.produced ?? 0 }}</span>
          <span v-if="row.status === 'running' && row.count" class="target-count-hint"> / {{ row.count }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="targetStatusType(row.status)" size="small">
            {{ targetStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>

    <el-descriptions :column="2" border style="margin-top: 24px">
      <el-descriptions-item label="任务 ID">{{ jobId }}</el-descriptions-item>
      <el-descriptions-item label="项目">{{ store.projectName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="当前阶段">{{ store.currentPhase }}</el-descriptions-item>
      <el-descriptions-item label="总进度">{{ store.overallPercent }}%</el-descriptions-item>
    </el-descriptions>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col v-for="phase in phases" :key="phase.key" :span="8">
        <el-card shadow="never">
          <div>{{ phase.label }}</div>
          <el-progress :percentage="phaseProgress(phase.key)" />
        </el-card>
      </el-col>
    </el-row>

    <el-timeline v-if="store.steps.length" style="margin-top: 24px">
      <el-timeline-item
        v-for="(step, index) in store.steps"
        :key="index"
        :timestamp="stepTimestamp(step)"
      >
        {{ step.note || step.message || `阶段 ${step.phase}` }}
        <span v-if="step.test_case_count != null">（{{ step.test_case_count }} 条）</span>
      </el-timeline-item>
    </el-timeline>

    <AgentConfigPanel
      :agent-context="store.agentContext"
      :job-options="store.jobOptions"
      :error-message="store.errorMessage"
      style="margin-top: 24px"
    />

    <div class="testgen-progress-actions">
      <el-button
        v-if="store.status === 'running' || store.status === 'pending'"
        type="danger"
        :loading="actionLoading"
        @click="handleCancel"
      >
        取消任务
      </el-button>
      <el-button
        v-if="store.status === 'failed'"
        type="warning"
        :loading="actionLoading"
        @click="handleRetry"
      >
        重试
      </el-button>
      <el-button
        v-if="store.status === 'done'"
        type="primary"
        @click="goToSuite"
      >
        查看用例库
      </el-button>
      <el-button @click="router.push({ name: 'test-scope' })">
        返回配置
      </el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import AgentConfigPanel from '../components/AgentConfigPanel.vue';
import { useJobProgress } from '../composables/useJobProgress';

const route = useRoute();
const router = useRouter();
const jobId = computed(() => route.params.id);
const { store } = useJobProgress(jobId);
const actionLoading = ref(false);

const phases = [
  { key: 'analyze', label: '需求分析' },
  { key: 'generate', label: '生成用例' },
  { key: 'review', label: '合规审查' },
];

const phaseOrder = ['analyze', 'generate', 'review'];

const phaseLabelMap = {
  analyze: '需求分析',
  generate: '生成用例',
  review: '合规审查',
  functional: '生成用例',
  edge: '生成用例',
};

const activeStep = computed(() => {
  let phase = store.currentPhase;
  if (phase === 'functional' || phase === 'edge') phase = 'generate';
  const idx = phaseOrder.indexOf(phase);
  return idx >= 0 ? idx : 0;
});

const currentPhaseLabel = computed(() => {
  let phase = store.currentPhase;
  if (phase === 'functional' || phase === 'edge') phase = 'generate';
  return phaseLabelMap[phase] || phase;
});

const currentTargetLabel = computed(() => {
  const t = store.currentTarget;
  if (!t) return '';
  return `${t.scheme_id || ''} ${t.scheme_name || ''} · ${t.validation_id || ''} ${t.validation_name || ''}`.trim();
});

const retryNotice = computed(() => store.agentContext?.retry_notice || '');

const failedTargetsNotice = computed(() => {
  const failed = (store.targetStates || []).filter(t => t.status === 'failed');
  if (!failed.length) return '';
  const labels = failed.map(t =>
    `${t.scheme_id || ''} · ${t.validation_id || ''}（目标 ${t.count} 条，有效 0 条）`,
  );
  return `以下目标未生成有效用例：${labels.join('；')}`;
});

const progressStatus = computed(() => {
  if (store.status === 'failed') return 'exception';
  if (store.status === 'done') return 'success';
  return undefined;
});

const statusLabel = computed(() => {
  const map = {
    pending: '等待中',
    running: '生成中',
    done: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[store.status] || store.status;
});

const statusTagType = computed(() => {
  const map = {
    pending: 'info',
    running: 'primary',
    done: 'success',
    failed: 'danger',
    cancelled: 'warning',
  };
  return map[store.status] || 'info';
});

function phaseProgress(key) {
  const p = store.progress || {};
  if (key === 'generate') {
    return Math.max(p.generate ?? 0, p.functional ?? 0, p.edge ?? 0);
  }
  return p[key] ?? 0;
}

function targetStatusLabel(status) {
  const map = { pending: '等待', running: '进行中', done: '完成', failed: '未生成' };
  return map[status] || status || '—';
}

function targetStatusType(status) {
  const map = { pending: 'info', running: 'primary', done: 'success', failed: 'danger' };
  return map[status] || 'info';
}

function stepTimestamp(step) {
  const parts = [step.phase];
  if (step.scheme_id) parts.push(step.scheme_id);
  if (step.validation_id) parts.push(step.validation_id);
  return parts.join(' · ');
}

function goToSuite() {
  router.push({
    name: 'test-suite',
    query: { generation_job_id: jobId.value },
  });
}

async function handleCancel() {
  actionLoading.value = true;
  try {
    await store.cancel();
    ElMessage.success('任务已取消');
  } catch (err) {
    ElMessage.error(err.message || '取消失败');
  } finally {
    actionLoading.value = false;
  }
}

async function handleRetry() {
  actionLoading.value = true;
  try {
    await store.retry();
    ElMessage.success('已重新提交任务');
  } catch (err) {
    ElMessage.error(err.message || '重试失败');
  } finally {
    actionLoading.value = false;
  }
}
</script>

<style scoped>
.target-count-hint {
  color: #909399;
  font-size: 12px;
}
</style>
