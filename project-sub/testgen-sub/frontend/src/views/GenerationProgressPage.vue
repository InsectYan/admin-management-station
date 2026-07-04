<template>
  <PageShell title="生成进度">
    <template #extra>
      <el-button @click="router.push({ name: 'generation-queue' })">
        查看任务列表
      </el-button>
    </template>

    <el-alert
      v-if="store.status === 'waiting'"
      type="info"
      title="等待中：当前任务在队列中排队，待前序任务执行完成后自动开始"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-alert
      v-if="store.status === 'paused'"
      type="warning"
      title="任务已暂停，可在任务列表中恢复执行"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

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

    <el-alert
      v-if="fitnessPostNotice"
      type="success"
      :title="fitnessPostNotice"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-card shadow="never" class="testgen-progress-card">
      <div class="testgen-progress-summary">
        <span class="testgen-progress-label">整体进度</span>
        <span class="testgen-progress-percent">
          {{ store.totalProduced }} / {{ store.totalConfigured }} 条 · {{ store.overallPercent }}%
        </span>
      </div>
      <el-progress
        :percentage="store.overallPercent"
        :status="progressStatus"
        :stroke-width="22"
        striped
        striped-flow
        :duration="10"
      />
      <div v-if="store.totalConfigured" class="testgen-progress-phase testgen-progress-count-hint">
        每轮固定请求 {{ roundRequestSizeLabel }} 条（与剩余条数无关），审查通过立即入库，超出目标部分自动截断
      </div>
      <div v-if="currentTargetLabel" class="testgen-progress-phase">
        当前目标：{{ currentTargetLabel }}<span v-if="currentBatchLabel"> · {{ currentBatchLabel }}</span>
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
      <el-table-column label="分批进度" width="100">
        <template #default="{ row }">
          <span v-if="row.batch_total">{{ row.batch_index || 0 }}/{{ row.batch_total }}</span>
          <span v-else class="target-count-hint">—</span>
        </template>
      </el-table-column>
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
      <el-descriptions-item label="总进度">
        {{ store.totalProduced }} / {{ store.totalConfigured }} 条（{{ store.overallPercent }}%）
      </el-descriptions-item>
    </el-descriptions>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col v-for="phase in phases" :key="phase.key" :span="8">
        <el-card shadow="never">
          <div>{{ phase.label }}</div>
          <el-progress :percentage="phaseProgress(phase.key)" />
        </el-card>
      </el-col>
    </el-row>

    <el-timeline v-if="milestoneSteps.length" style="margin-top: 24px">
      <el-timeline-item
        v-for="(step, index) in milestoneSteps"
        :key="index"
        :timestamp="stepTimestamp(step)"
        :type="step.phase === 'persist' ? 'success' : step.phase === 'retry' ? 'warning' : 'primary'"
      >
        {{ stepDisplayText(step) }}
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
        v-if="store.status === 'running' || store.status === 'waiting'"
        type="warning"
        :loading="actionLoading"
        @click="handlePause"
      >
        暂停任务
      </el-button>
      <el-button
        v-if="store.status === 'running' || store.status === 'waiting' || store.status === 'pending'"
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
        v-if="store.canViewResults"
        type="primary"
        @click="goToSuite"
      >
        查看用例库
      </el-button>
      <el-button
        v-if="store.canViewResults"
        :loading="importLoading"
        @click="openImportDialog"
      >
        导入样本集
      </el-button>
      <el-button @click="router.push({ name: 'test-scope' })">
        返回配置
      </el-button>
    </div>

    <el-dialog v-model="importDialogVisible" title="导入至样本集" width="420px">
      <el-select v-model="selectedSampleSetId" placeholder="选择样本集" style="width:100%">
        <el-option
          v-for="s in sampleSets"
          :key="s.id"
          :label="`${s.name} (#${s.id})`"
          :value="s.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importLoading" @click="confirmImport">确认导入</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import AgentConfigPanel from '../components/AgentConfigPanel.vue';
import { useJobProgress } from '../composables/useJobProgress';
import { importJobSamples } from '../services/generationService.js';
import { fetchSampleSets } from '../services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const jobId = computed(() => route.params.id);
const { store } = useJobProgress(jobId);
const actionLoading = ref(false);
const importLoading = ref(false);
const importDialogVisible = ref(false);
const sampleSets = ref([]);
const selectedSampleSetId = ref(null);

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

const currentBatchLabel = computed(() => {
  const t = store.currentTarget;
  if (!t?.batch_index) return '';
  const size = t.round_request_size || t.current_batch_size || 10;
  return `第 ${t.batch_index}/${t.batch_total} 段（每轮固定 ${size} 条）`;
});

const roundRequestSizeLabel = computed(() => {
  const profile = store.agentContext?.llm_profile_id || '';
  const id = String(profile || 'ollama-qwen').toLowerCase();
  const isLocal = !profile || id.startsWith('ollama') || id === 'env-fallback';
  return isLocal ? '5（本地模型）' : '10（云端模型）';
});

/** 仅展示 BFF 入库/补生成里程碑，隐藏 Agent 内部 analyze/functional/edge/review 步 */
const milestoneSteps = computed(() =>
  (store.steps || []).filter(step => {
    if (step.bff_milestone) return true;
    if (step.phase === 'persist' || step.phase === 'retry') return true;
    return false;
  }),
);

const retryNotice = computed(() => store.agentContext?.retry_notice || '');

const fitnessPostNotice = computed(() => {
  const post = store.agentContext?.fitness_post_process;
  if (!post) return '';
  const parts = [];
  if (post.enrich && !post.enrich.error) parts.push('样本 AI 补全已完成');
  if (post.dry_run?.run_id) parts.push(`dry-run Run #${post.dry_run.run_id}`);
  if (post.dry_run?.error) parts.push(`dry-run 失败: ${post.dry_run.error}`);
  return parts.join(' · ');
});

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
  if (store.status === 'done' || store.status === 'partial') return 'success';
  return undefined;
});

const statusLabel = computed(() => {
  const map = {
    pending: '等待中',
    waiting: '等待中',
    running: '生成中',
    paused: '已暂停',
    done: '已完成',
    partial: '部分完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[store.status] || store.status;
});

const statusTagType = computed(() => {
  const map = {
    pending: 'info',
    waiting: 'info',
    running: 'primary',
    paused: 'warning',
    done: 'success',
    partial: 'warning',
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
  const map = {
    pending: '等待',
    running: '进行中',
    done: '完成',
    partial: '部分完成',
    failed: '未生成',
  };
  return map[status] || status || '—';
}

function targetStatusType(status) {
  const map = {
    pending: 'info',
    running: 'primary',
    done: 'success',
    partial: 'warning',
    failed: 'danger',
  };
  return map[status] || 'info';
}

function stepDisplayText(step) {
  if (step.note) return step.note;
  if (step.message) return step.message;
  return `阶段 ${step.phase || '—'}`;
}

function stepTimestamp(step) {
  const parts = [];
  if (step.phase === 'persist') parts.push('入库');
  else if (step.phase === 'retry') parts.push('补生成');
  else parts.push(step.phase || '步骤');
  if (step.scheme_id) parts.push(step.scheme_id);
  if (step.validation_id) parts.push(step.validation_id);
  if (step.attempt != null) parts.push(`第 ${step.attempt} 轮`);
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

async function handlePause() {
  actionLoading.value = true;
  try {
    await store.pause();
    ElMessage.success('任务已暂停');
  } catch (err) {
    ElMessage.error(err.message || '暂停失败');
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

async function openImportDialog() {
  importDialogVisible.value = true;
  try {
    const data = await fetchSampleSets({ pageSize: 100 });
    sampleSets.value = data.list || [];
    selectedSampleSetId.value = sampleSets.value[0]?.id ?? null;
  } catch (err) {
    ElMessage.error(err.message || '加载样本集失败');
  }
}

async function confirmImport() {
  if (!selectedSampleSetId.value) {
    ElMessage.warning('请选择样本集');
    return;
  }
  importLoading.value = true;
  try {
    const result = await importJobSamples(jobId.value, { sample_set_id: selectedSampleSetId.value });
    ElMessage.success(`已导入 ${result.created_count ?? result.items?.length ?? 0} 条样本`);
    importDialogVisible.value = false;
  } catch (err) {
    ElMessage.error(err.message || '导入失败');
  } finally {
    importLoading.value = false;
  }
}
</script>

<style scoped>
.target-count-hint {
  color: #909399;
  font-size: 12px;
}
.testgen-progress-count-hint {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
