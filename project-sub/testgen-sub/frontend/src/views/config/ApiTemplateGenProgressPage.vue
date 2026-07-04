<template>
  <PageShell title="接口模板生成进度">
    <el-alert
      v-if="store.errorMessage"
      type="error"
      :title="store.errorMessage"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-alert
      v-if="importNotice"
      type="success"
      :title="importNotice"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-card shadow="never" class="api-tpl-progress-card">
      <div class="api-tpl-progress-summary">
        <span class="api-tpl-progress-label">整体进度</span>
        <span class="api-tpl-progress-percent">{{ store.overallPercent }}%</span>
      </div>
      <el-progress
        :percentage="store.overallPercent"
        :status="progressStatus"
        :stroke-width="22"
        striped
        striped-flow
        :duration="10"
      />
      <div class="api-tpl-progress-phase">
        当前阶段：{{ currentPhaseLabel }}
      </div>
      <div v-if="store.agentContext.current_direction" class="api-tpl-progress-direction">
        {{ store.agentContext.current_direction }}
      </div>
    </el-card>

    <el-steps :active="activeStep" finish-status="success" align-center style="margin-top: 24px">
      <el-step title="文档分析" description="analyze" />
      <el-step title="生成模板" description="generate" />
      <el-step title="模板评审" description="review" />
    </el-steps>

    <el-descriptions :column="2" border style="margin-top: 24px">
      <el-descriptions-item label="任务 ID">{{ jobId }}</el-descriptions-item>
      <el-descriptions-item label="项目">{{ store.projectName || store.projectCode || '—' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="模板数">{{ store.templatesCount }}</el-descriptions-item>
      <el-descriptions-item label="导入状态">
        <el-tag :type="importTagType">{{ importStatusLabel }}</el-tag>
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

    <el-card v-if="store.generatedTemplates.length" shadow="never" style="margin-top: 24px">
      <template #header>
        <span>生成结果预览（{{ store.generatedTemplates.length }} 条）</span>
      </template>
      <el-table
        :data="store.generatedTemplates"
        size="small"
        border
        @selection-change="onSelectionChange"
      >
        <el-table-column v-if="canImport" type="selection" width="48" />
        <el-table-column prop="template_code" label="编码" min-width="140" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="http_method" label="方法" width="80" />
        <el-table-column prop="url_path" label="路径" min-width="160" />
        <el-table-column label="注入字段" width="90">
          <template #default="{ row }">
            {{ row.inject_schema?.length || 0 }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-timeline v-if="store.steps.length" style="margin-top: 24px">
      <el-timeline-item
        v-for="(step, index) in store.steps"
        :key="index"
      >
        {{ step.note || step.message || `阶段 ${step.phase}` }}
        <span v-if="step.template_count != null">（{{ step.template_count }} 条模板）</span>
      </el-timeline-item>
    </el-timeline>

    <AgentConfigPanel
      :agent-context="store.agentContext"
      :job-options="store.jobOptions"
      :error-message="store.errorMessage"
      style="margin-top: 24px"
    />

    <div class="api-tpl-progress-actions">
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
        v-if="canImport"
        type="primary"
        :loading="importLoading"
        @click="handleConfirmImport"
      >
        确认导入接口模板库
      </el-button>
      <el-button
        v-if="store.isImported"
        type="primary"
        @click="goToList"
      >
        查看接口模板
      </el-button>
      <el-button @click="router.push({ name: 'api-template-gen' })">
        返回配置
      </el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import AgentConfigPanel from '@/components/AgentConfigPanel.vue';
import { useApiTemplateGenProgress } from '@/composables/useApiTemplateGenProgress';
import { confirmImportApiTemplates } from '@/services/apiTemplateGenService';

const route = useRoute();
const router = useRouter();
const jobId = computed(() => route.params.id);
const { store } = useApiTemplateGenProgress(jobId);

const actionLoading = ref(false);
const importLoading = ref(false);
const selectedTemplates = ref([]);
const importNotice = ref('');

const phases = [
  { key: 'analyze', label: '文档分析' },
  { key: 'generate', label: '生成模板' },
  { key: 'review', label: '模板评审' },
];

const phaseIndexMap = { analyze: 0, generate: 1, review: 2 };

const activeStep = computed(() => phaseIndexMap[store.currentPhase] ?? 0);

const currentPhaseLabel = computed(() => {
  const map = { analyze: '文档分析', generate: '生成模板', review: '模板评审' };
  return map[store.currentPhase] || store.currentPhase;
});

const statusLabel = computed(() => {
  const map = {
    pending: '等待中', running: '生成中', done: '已完成',
    failed: '失败', cancelled: '已取消',
  };
  return map[store.status] || store.status;
});

const statusTagType = computed(() => {
  const map = { done: 'success', failed: 'danger', cancelled: 'info', running: 'warning' };
  return map[store.status] || 'info';
});

const progressStatus = computed(() => {
  if (store.status === 'failed') return 'exception';
  if (store.status === 'done') return 'success';
  return undefined;
});

const canImport = computed(() =>
  store.status === 'done' && !store.isImported && store.generatedTemplates.length > 0,
);

const importStatusLabel = computed(() => {
  const map = { pending: '待导入', imported: '已导入', failed: '导入失败' };
  return map[store.importStatus] || store.importStatus;
});

const importTagType = computed(() => {
  const map = { imported: 'success', failed: 'danger' };
  return map[store.importStatus] || 'info';
});

function phaseProgress(key) {
  return store.progress?.[key] ?? 0;
}

function onSelectionChange(rows) {
  selectedTemplates.value = rows;
}

async function handleCancel() {
  actionLoading.value = true;
  try {
    await store.cancel();
    ElMessage.info('任务已取消');
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
    ElMessage.success('已重新提交');
  } catch (err) {
    ElMessage.error(err.message || '重试失败');
  } finally {
    actionLoading.value = false;
  }
}

async function handleConfirmImport() {
  const templates = selectedTemplates.value.length
    ? selectedTemplates.value
    : store.generatedTemplates;

  await ElMessageBox.confirm(
    `确认将 ${templates.length} 条接口模板导入数据库？`,
    '确认导入',
    { type: 'warning' },
  );

  importLoading.value = true;
  try {
    const template_codes = templates.map(t => t.template_code);
    const result = await confirmImportApiTemplates(jobId.value, { template_codes });
    importNotice.value = `已成功导入 ${result.imported} 条${result.skipped ? `，跳过 ${result.skipped} 条` : ''}`;
    await store.fetchJob(jobId.value);
    ElMessage.success('导入完成');
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || err.message || '导入失败');
  } finally {
    importLoading.value = false;
  }
}

function goToList() {
  router.push({ name: 'config-api-templates' });
}
</script>

<style scoped>
.api-tpl-progress-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.api-tpl-progress-percent {
  font-size: 20px;
  font-weight: 600;
}
.api-tpl-progress-phase,
.api-tpl-progress-direction {
  margin-top: 8px;
  color: #606266;
  font-size: 13px;
}
.api-tpl-progress-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
