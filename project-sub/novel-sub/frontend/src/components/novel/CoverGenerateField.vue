<template>
  <el-card class="novel-cover-card" shadow="never">
    <template #header>
      <span>封面</span>
    </template>
    <div class="novel-cover-field">
      <div class="novel-cover-field__tools">
        <el-select
          v-model="workflowId"
          class="novel-cover-field__workflow"
          filterable
          :loading="loadingWorkflows"
          :disabled="!workflows.length"
          placeholder="选择预检里可用的文生图工作流"
          @change="rememberWorkflow"
        >
          <el-option
            v-for="item in workflows"
            :key="item.id"
            :label="workflowLabel(item)"
            :value="item.id"
          />
        </el-select>
        <el-button :loading="loadingWorkflows" @click="loadWorkflows(true)">重新读取</el-button>
      </div>
      <p class="novel-cover-field__hint">{{ specText }}</p>
      <p v-if="sizeNote" class="novel-cover-field__hint">{{ sizeNote }}</p>
      <p v-if="workflowError" class="novel-cover-field__hint novel-cover-field__hint--warn">{{ workflowError }}</p>
      <ul v-if="!workflows.length && blocked.length" class="novel-cover-field__blocked">
        <li v-for="item in blocked" :key="item.id">{{ item.name }}：{{ item.reason }}</li>
      </ul>
      <el-input
        :model-value="form.cover_url"
        placeholder="列表和详情用的封面地址。生成后自动换成最新一张"
        @update:model-value="onUrlInput"
        @blur="onUrlBlur"
      >
        <template #prepend>地址</template>
      </el-input>
      <el-input
        :model-value="form.cover_prompt"
        type="textarea"
        :rows="3"
        placeholder="封面提示词。可在林间写手里选「封面扩写」，按描述写成能出图的句子。留空则按书名、立意和简介来写"
        @update:model-value="onPromptInput"
      />
      <div class="novel-cover-field__row">
        <el-button type="primary" plain :loading="loading" :disabled="!workflowId" @click="onGenerate">
          生成封面
        </el-button>
        <RandomSeedField ref="seedField" v-model="seed" />
      </div>
      <p class="novel-cover-field__hint">同一提示词、同一种子只会出同一张图。开关打开时，每次生成先换成一个 8 到 10 位的新种子，并写进旁边的输入框。关掉后只使用手填的数字。</p>
      <el-progress v-if="loading" :percentage="coverPercent" :stroke-width="8" />
      <p v-if="loading" class="novel-cover-field__hint">{{ coverNote }}</p>
      <MediaFileList :items="gallery" @remove="removeCover" />
      <p v-if="!gallery.length" class="novel-cover-field__empty">暂无封面</p>
    </div>
  </el-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchCoverJob, fetchCoverWorkflows, generateCover } from '../../services/novelService.js';
import { coverImageSrc } from '../../lib/publicHost.js';
import MediaFileList from '../MediaFileList.vue';
import RandomSeedField from '../RandomSeedField.vue';

const WORKFLOW_KEY = 'novel-cover-workflow-id';
const FALLBACK_SPEC = { width: 768, height: 1024, ratio: '3:4' };

const props = defineProps({
  form: { type: Object, required: true },
});

const emit = defineEmits(['change']);

const loading = ref(false);
const coverPercent = ref(0);
const coverNote = ref('');
let coverTimer = null;
const loadingWorkflows = ref(false);
const workflows = ref([]);
const blocked = ref([]);
const coverSpec = ref({ ...FALLBACK_SPEC });
const workflowId = ref(null);
const workflowError = ref('');
const seed = ref(null);
const seedField = ref(null);

const gallery = computed(() => {
  const list = Array.isArray(props.form.cover_images) ? props.form.cover_images : [];
  return list.map(item => ({
    id: item.id,
    url: coverImageSrc(item.url),
    kind: 'image',
    name: item.name || '封面',
    deletable: true,
  }));
});

const specText = computed(() => {
  const spec = coverSpec.value;
  return `封面按 ${spec.ratio} 展示。请把工作流的出图宽高调成 ${spec.width}×${spec.height}，再生成。比例不一致时，列表卡片会裁切，详情页会留边完整显示。`;
});

const sizeNote = computed(() => {
  const current = workflows.value.find(item => item.id === workflowId.value);
  if (!current) return '';
  const spec = coverSpec.value;
  const parts = [];
  if (current.width && current.height) {
    parts.push(current.width === spec.width && current.height === spec.height
      ? `这份工作流当前就是 ${current.width}×${current.height}。`
      : `这份工作流当前是 ${current.width}×${current.height}，和封面建议的 ${spec.width}×${spec.height} 不一致。`);
  }
  if (current.warning) parts.push(`${current.warning}。仍可生成，显存不够时 ComfyUI 会失败。`);
  return parts.join('');
});

function workflowLabel(item) {
  const size = item.width && item.height ? `（${item.width}×${item.height}）` : '';
  const warn = item.warning ? ' · 显存偏低' : '';
  return `${item.name}${size}${warn}`;
}

function rememberWorkflow(id) {
  try {
    if (id) sessionStorage.setItem(WORKFLOW_KEY, String(id));
  } catch { /* 无痕模式不记上次选择 */ }
}

function savedWorkflowId() {
  try {
    return Number(sessionStorage.getItem(WORKFLOW_KEY) || 0);
  } catch {
    return 0;
  }
}

function pickWorkflow(list) {
  const saved = savedWorkflowId();
  const chosen = list.find(item => item.id === saved) || list[0];
  workflowId.value = chosen ? chosen.id : null;
}

async function loadWorkflows(refresh = false) {
  loadingWorkflows.value = true;
  workflowError.value = '';
  try {
    const data = await fetchCoverWorkflows(refresh);
    coverSpec.value = data?.spec?.width ? data.spec : { ...FALLBACK_SPEC };
    workflows.value = Array.isArray(data?.workflows) ? data.workflows : [];
    blocked.value = Array.isArray(data?.blocked) ? data.blocked.slice(0, 3) : [];
    pickWorkflow(workflows.value);
    if (!workflows.value.length) {
      workflowError.value = blocked.value.length
        ? '预检里的文生图工作流当前都不可用。'
        : '预检里还没有可用的文生图工作流。';
    }
  } catch (err) {
    workflows.value = [];
    blocked.value = [];
    workflowId.value = null;
    workflowError.value = err.message || '读取预检工作流失败';
  } finally {
    loadingWorkflows.value = false;
  }
}

function ensureImages() {
  if (!Array.isArray(props.form.cover_images)) props.form.cover_images = [];
  return props.form.cover_images;
}

function onUrlInput(val) {
  props.form.cover_url = val;
  emit('change');
}

function onUrlBlur() {
  const url = String(props.form.cover_url || '').trim();
  if (!url) return;
  const list = ensureImages();
  if (list.some(item => item.url === url)) return;
  props.form.cover_images = [{
    id: `c${Date.now().toString(36)}`,
    url,
    name: url.split('/').pop() || '封面',
  }, ...list];
  emit('change');
}

function onPromptInput(val) {
  props.form.cover_prompt = val;
  emit('change');
}

function rememberCover(url) {
  const clean = String(url || '').trim();
  if (!clean) return;
  const list = ensureImages().filter(item => item.url !== clean);
  props.form.cover_images = [{
    id: `c${Date.now().toString(36)}`,
    url: clean,
    name: clean.split('/').pop() || '封面',
  }, ...list];
  props.form.cover_url = clean;
  emit('change');
}

async function removeCover(item) {
  try {
    await ElMessageBox.confirm('删除这张封面后，列表和详情会改用剩下的第一张。', '删除封面', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  const list = ensureImages().filter(row => row.id !== item.id);
  props.form.cover_images = list;
  if (!list.some(row => row.url === props.form.cover_url)) {
    props.form.cover_url = list[0]?.url || '';
  }
  emit('change');
}

async function onGenerate() {
  if (!workflowId.value) {
    ElMessage.warning('请先选择可用的文生图工作流');
    return;
  }
  if (!String(props.form.title || '').trim() && !String(props.form.cover_prompt || '').trim()) {
    ElMessage.warning('请先填写书名或封面提示词');
    return;
  }
  const nextSeed = seedField.value?.takeSeed();
  if (nextSeed == null) {
    ElMessage.warning('请填写种子，或打开随机开关');
    return;
  }
  loading.value = true;
  coverPercent.value = 0;
  coverNote.value = '已提交，正在排队';
  const jobId = `cover${Date.now().toString(36)}`;
  if (coverTimer) clearInterval(coverTimer);
  coverTimer = setInterval(async () => {
    try {
      const job = await fetchCoverJob(jobId);
      if (!job || job.status === 'idle') return;
      coverPercent.value = job.status === 'success' ? 100 : (job.progress_percent || 0);
      if (job.phase === 'queued') {
        coverNote.value = job.queue_ahead > 0 ? `排队，前面还有 ${job.queue_ahead} 个` : '排队中';
      } else if (job.progress_max > 0) {
        coverNote.value = `ComfyUI ${job.progress_value}/${job.progress_max}`;
      } else if (job.status === 'failed') {
        coverNote.value = job.error || '封面生成失败';
      } else {
        coverNote.value = '正在生成，等待 ComfyUI 回报步数';
      }
    } catch {
      /* 进度读不到时，生成请求仍会继续 */
    }
  }, 1000);
  try {
    const data = await generateCover({
      title: props.form.title,
      creative_intent: props.form.creative_intent,
      summary: props.form.summary,
      story_overview: props.form.story_overview,
      prompt: props.form.cover_prompt,
      workflow_id: workflowId.value,
      job_id: jobId,
      seed: nextSeed,
    });
    rememberCover(data.cover_url);
    const name = data.workflow_name ? `「${data.workflow_name}」` : '';
    ElMessage.success(name ? `已用工作流${name}生成封面` : '封面已生成');
  } catch (err) {
    ElMessage.error(err.message || '封面生成失败');
  } finally {
    if (coverTimer) clearInterval(coverTimer);
    coverTimer = null;
    loading.value = false;
  }
}

onMounted(() => {
  loadWorkflows(false);
});
</script>

<style scoped>
.novel-cover-card {
  width: 100%;
  border-color: rgba(47, 138, 91, 0.18);
  background: rgba(255, 255, 255, 0.55);
}

.novel-cover-card :deep(.el-card__header) {
  padding: 10px 14px;
  font-weight: 600;
  color: var(--novel-color-text, #2f3d34);
}

.novel-cover-card :deep(.el-card__body) {
  padding: 12px 14px 14px;
}

.novel-cover-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.novel-cover-field__tools,
.novel-cover-field__row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.novel-cover-field :deep(.el-input-group__prepend) {
  width: 64px;
  justify-content: center;
  color: var(--novel-color-text, #2f3d34);
  background: var(--novel-color-primary-muted, #eef6f1);
}

.novel-cover-field__workflow {
  flex: 1;
  min-width: 180px;
}

.novel-cover-field__hint {
  margin: 0;
  font-size: 12px;
  color: var(--novel-color-moon, #6b7c72);
  line-height: 1.5;
}

.novel-cover-field__hint--warn {
  color: var(--novel-color-warning, #e6a23c);
}

.novel-cover-field__blocked {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--novel-color-text-muted, #5c6b62);
  line-height: 1.5;
}

.novel-cover-field__empty {
  margin: 0;
  color: var(--novel-color-moon, #6b7c72);
  font-size: 13px;
}
</style>
