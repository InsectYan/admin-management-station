<template>
  <PageShell title="生成进度">
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
      <div class="testgen-progress-phase">
        当前阶段：{{ currentPhaseLabel }}
      </div>
    </el-card>

    <el-steps :active="activeStep" finish-status="success" align-center style="margin-top: 24px">
      <el-step title="需求分析" description="analyze" />
      <el-step title="功能用例" description="functional" />
      <el-step title="边界用例" description="edge" />
      <el-step title="合规审查" description="review" />
    </el-steps>

    <el-descriptions :column="2" border style="margin-top: 24px">
      <el-descriptions-item label="任务 ID">{{ jobId }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="当前阶段">{{ store.currentPhase }}</el-descriptions-item>
      <el-descriptions-item label="总进度">{{ store.overallPercent }}%</el-descriptions-item>
    </el-descriptions>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col v-for="phase in phases" :key="phase.key" :span="6">
        <el-card shadow="never">
          <div>{{ phase.label }}</div>
          <el-progress :percentage="store.progress[phase.key] ?? 0" />
        </el-card>
      </el-col>
    </el-row>

    <el-timeline v-if="store.steps.length" style="margin-top: 24px">
      <el-timeline-item
        v-for="(step, index) in store.steps"
        :key="index"
        :timestamp="step.phase"
      >
        {{ step.note || step.message || `阶段 ${step.phase}` }}
        <span v-if="step.test_case_count != null">（{{ step.test_case_count }} 条用例）</span>
      </el-timeline-item>
    </el-timeline>

    <AgentConfigPanel
      :agent-context="store.agentContext"
      :job-options="store.jobOptions"
      :test-types="store.testTypes"
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
        查看用例列表
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
  { key: 'functional', label: '功能用例' },
  { key: 'edge', label: '边界用例' },
  { key: 'review', label: '合规审查' },
];

const phaseOrder = ['analyze', 'functional', 'edge', 'review'];

const phaseLabelMap = {
  analyze: '需求分析',
  functional: '功能用例',
  edge: '边界用例',
  review: '合规审查',
};

const activeStep = computed(() => {
  const idx = phaseOrder.indexOf(store.currentPhase);
  return idx >= 0 ? idx : 0;
});

const currentPhaseLabel = computed(() =>
  phaseLabelMap[store.currentPhase] || store.currentPhase,
);

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

function goToSuite() {
  router.push({ name: 'test-suite', query: { job_id: jobId.value } });
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
