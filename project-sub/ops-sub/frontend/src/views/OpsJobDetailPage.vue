<template>
  <PageShell :title="title">
    <template #extra>
      <el-button @click="router.push('/jobs')">返回队列</el-button>
      <el-button v-if="canRetry" type="primary" :loading="acting" @click="onRetry">重试</el-button>
      <el-button v-if="canCancel" type="danger" :loading="acting" @click="onCancel">取消</el-button>
    </template>

    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <template v-else-if="job">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="项目">{{ job.project_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ kindLabel(job.kind) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag size="small" :type="taskStatusMeta(job.status).type">{{ taskStatusMeta(job.status).label }}</el-tag>
          <el-tag v-if="job.stuck" size="small" type="danger" class="ops-stuck-tag">卡住</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="耗时">{{ formatDuration(job.queue_seconds) }}</el-descriptions-item>
        <el-descriptions-item label="Comfy 提示">{{ job.prompt_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(job.updated_at) }}</el-descriptions-item>
        <el-descriptions-item label="错误" :span="2">{{ job.error_message || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="job.precheck_workflow_id" label="预检工作流">
          <a class="ops-precheck-link" :href="precheckHref(job.precheck_workflow_id)" target="_blank" rel="noreferrer">{{ job.precheck_workflow_id }} · 打开梳理</a>
        </el-descriptions-item>
        <el-descriptions-item v-if="gapNodes" label="缺失节点" :span="2">{{ gapNodes }}</el-descriptions-item>
        <el-descriptions-item v-if="gapModels" label="缺失模型" :span="2">{{ gapModels }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        class="ops-diagnosis"
        type="warning"
        :title="`阶段：${stageLabel(job.diagnosis?.stage)}`"
        :description="job.diagnosis?.suggestion"
        show-icon
        :closable="false"
      />

      <h4 class="ops-block-title">分镜与提示词</h4>
      <el-descriptions v-if="job.shot" :column="1" border>
        <el-descriptions-item label="分镜">{{ job.shot.description || '—' }}</el-descriptions-item>
        <el-descriptions-item label="景别 / 运镜">{{ [job.shot.shot_size, job.shot.camera_move].filter(Boolean).join(' / ') || '—' }}</el-descriptions-item>
        <el-descriptions-item label="正向提示词">{{ job.prompt?.positive_zh || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="没有关联分镜" />

      <h4 class="ops-block-title">产物</h4>
      <el-empty v-if="!(job.outputs || []).length" description="还没有产物" />
      <ul v-else class="ops-output-list">
        <li v-for="item in job.outputs" :key="item.id">{{ item.media_kind }} · {{ item.file_path }}</li>
      </ul>
    </template>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { cancelContentJob, fetchContentJob, retryContentJob } from '../services/contentOpsService.js';
import { formatDuration, kindLabel, taskStatusMeta } from '../utils/contentMeta.js';
import { formatDateTime } from '../utils/opsMeta.js';

const route = useRoute();
const router = useRouter();
const job = ref(null);
const loadError = ref('');
const acting = ref(false);
const title = computed(() => (job.value ? `任务 #${job.value.id}` : '失败诊断'));
const canRetry = computed(() => job.value && (job.value.status === 'failed' || job.value.status === 'cancelled'));
const canCancel = computed(() => job.value && [ 'pending', 'queued', 'running' ].includes(job.value.status));
const gapNodes = computed(() => (job.value?.precheck_gap?.missing_nodes || []).join('、'));
const gapModels = computed(() => (job.value?.precheck_gap?.missing_models || []).join('、'));

function precheckHref(id) {
  const origin = import.meta.env.VITE_PRECHECK_ORIGIN || 'http://localhost:5104';
  return `${origin.replace(/\/$/, '')}/workflows?id=${id}`;
}

function stageLabel(stage) {
  if (stage === 'precheck') return '预检';
  if (stage === 'comfy') return 'ComfyUI';
  return '未判定';
}

async function load() {
  loadError.value = '';
  try {
    job.value = await fetchContentJob(route.params.bizApp, route.params.externalId);
  } catch (err) {
    loadError.value = err.message;
  }
}

async function onRetry() {
  try {
    await ElMessageBox.confirm('使用原来的提示词重新提交这个任务？', '重试');
  } catch {
    return;
  }
  acting.value = true;
  try {
    job.value = await retryContentJob(route.params.bizApp, route.params.externalId);
    ElMessage.success('已提交重试');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    acting.value = false;
  }
}

async function onCancel() {
  try {
    await ElMessageBox.confirm('取消这个任务？', '取消任务');
  } catch {
    return;
  }
  acting.value = true;
  try {
    job.value = await cancelContentJob(route.params.bizApp, route.params.externalId);
    ElMessage.success('已取消');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ops-diagnosis {
  margin: 16px 0;
}
.ops-block-title {
  margin: 20px 0 12px;
  font-size: 15px;
}
.ops-stuck-tag {
  margin-left: 6px;
}
.ops-output-list {
  margin: 0;
  padding-left: 18px;
}
.ops-precheck-link { color: #2f8a5b; }
</style>
