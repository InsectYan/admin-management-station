<template>
  <PageShell title="获取提示词" :loading="loading && !ready">
    <template #extra>
      <div v-if="job.active" class="caption-progress">
        <el-progress :percentage="job.percent || 0" :indeterminate="job.waiting" :stroke-width="8" color="#2f8a5b" />
        <span>{{ job.note }}</span>
      </div>
      <el-button :disabled="!canMake() || !workflowId" @click="runEmpty">一键执行</el-button>
      <el-button link type="primary" @click="back">返回项目</el-button>
    </template>
    <div class="caption-page">
      <div class="caption-page__scroll">
        <section class="cartoon-module">
          <el-form label-position="top">
            <el-form-item label="反推工作流">
              <el-select v-model="workflowId" filterable placeholder="选择反推工作流" style="width: 100%">
                <el-option v-for="item in workflows" :key="item.id" :label="workflowLabel(item)" :value="item.id" />
              </el-select>
              <p v-if="workflowsError" class="cartoon-module__hint">{{ workflowsError }}</p>
              <p class="cartoon-module__hint">图片和视频要各自选对应的工作流。一键执行只跑提示词还空着、且和当前工作流类型一致的卡片。</p>
            </el-form-item>
            <el-form-item label="上传图片、视频">
              <el-upload
                action="#"
                multiple
                :auto-upload="false"
                :show-file-list="false"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mov"
                :on-change="onPick"
              >
                <el-button type="primary" plain :loading="uploading">批量上传</el-button>
              </el-upload>
              <p class="cartoon-module__hint">可以一次选多张图片或多个视频。图片不超过 12MB，视频不超过 64MB。</p>
            </el-form-item>
            <el-form-item label="公共补充提示">
              <el-input v-model="shared" type="textarea" :rows="3" placeholder="可以不填。卡片没有单独补充提示时用这一段" />
              <p class="cartoon-module__hint">卡片里写了单独补充提示，就用卡片里的。卡片留空，才用这里的公共补充提示。</p>
            </el-form-item>
          </el-form>
        </section>
        <el-empty v-if="ready && !cards.length" description="还没有上传图片或视频" />
        <div v-else class="caption-grid">
          <article v-for="card in cards" :key="card.id" class="caption-card">
            <header>
              <strong>{{ card.original_name || (card.media_kind === 'video' ? '视频' : '图片') }}</strong>
              <span>
                <el-button link type="danger" :disabled="busy(card)" @click="removeCard(card)">移除</el-button>
                <el-button size="small" type="primary" :disabled="!canMake() || busy(card)" @click="runOne(card)">执行</el-button>
              </span>
            </header>
            <video v-if="card.media_kind === 'video'" :src="fileUrl(card)" muted controls preload="metadata"></video>
            <img v-else :src="fileUrl(card)" alt="" />
            <el-input v-model="card.extra_prompt" type="textarea" :rows="2" placeholder="单独补充提示，可以不填" />
            <el-input v-model="card.result_prompt" type="textarea" :rows="5" placeholder="生成的提示词" />
            <p v-if="busy(card)" class="cartoon-module__hint">{{ cardNote(card) }}</p>
            <p v-else-if="card.error_message" class="caption-card__error">{{ card.error_message }}</p>
          </article>
        </div>
      </div>
      <div class="caption-page__dock">
        <el-button type="primary" :disabled="!canMake()" :loading="saving" @click="save">保存</el-button>
      </div>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const route = useRoute();
const router = useRouter();
const projectId = route.params.id;
const loading = ref(true);
const ready = ref(false);
const uploading = ref(false);
const saving = ref(false);
const workflows = ref([]);
const workflowsError = ref('');
const workflowId = ref(null);
const shared = ref('');
const cards = ref([]);
const job = ref({ active: false, waiting: false, percent: 0, note: '' });
const queue = [];
let pumping = false;
let timer = null;

function workflowLabel(item) {
  return `${item.name} · ${item.media === 'video' ? '视频' : '图片'}`;
}
function fileUrl(card) {
  return `${resolveApiBase()}/projects/${projectId}/captions/${card.id}/file`;
}
function busy(card) {
  return card.status === 'queued' || card.status === 'running';
}
function cardNote(card) {
  if (card.status === 'queued') return '排队，等上一条拿到提示词';
  if (card.progress_max > 0) {
    const node = card.node ? `节点 ${card.node} ` : '';
    return `${node}${card.progress_value}/${card.progress_max}`;
  }
  return '正在反推，等待步数';
}
function applyBoard(data, resetText) {
  workflows.value = data?.workflows || [];
  workflowsError.value = data?.workflows_error || '';
  job.value = data?.job || { active: false, waiting: false, percent: 0, note: '' };
  if (!ready.value || resetText) {
    shared.value = data?.shared_prompt || '';
    workflowId.value = data?.workflow_id || null;
  }
  const local = new Map(cards.value.map(item => [ item.id, item ]));
  cards.value = (data?.cards || []).map(item => {
    const prev = local.get(item.id);
    if (!prev || resetText) return { ...item, _serverResult: item.result_prompt || '' };
    return {
      ...item,
      extra_prompt: prev.extra_prompt,
      result_prompt: prev.result_prompt === prev._serverResult ? (item.result_prompt || '') : prev.result_prompt,
      _serverResult: item.result_prompt || '',
    };
  });
  ready.value = true;
  if (job.value.active) follow();
  else stop();
}
async function load(resetText) {
  const data = await request(`/projects/${projectId}/captions`);
  applyBoard(data, resetText);
}
function follow() {
  if (timer) return;
  timer = setInterval(() => {
    load(false).catch(() => {});
  }, 1500);
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
function back() {
  router.push({ path: `/projects/${projectId}`, query: { tab: '5' } });
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, data: String(reader.result || '') });
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}
function onPick(uploadFile) {
  const file = uploadFile?.raw;
  if (file) queue.push(file);
  pump();
}
async function pump() {
  if (pumping) return;
  pumping = true;
  uploading.value = true;
  try {
    while (queue.length) {
      const file = queue.shift();
      const data = await readFile(file);
      const saved = await request(`/projects/${projectId}/captions/files`, {
        method: 'post',
        data,
        timeout: 120000,
      });
      applyBoard(saved, false);
    }
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    uploading.value = false;
    pumping = false;
    if (queue.length) pump();
  }
}
function payload() {
  return {
    shared_prompt: shared.value,
    workflow_id: workflowId.value,
    cards: cards.value.map(item => ({
      id: item.id,
      extra_prompt: item.extra_prompt,
      result_prompt: item.result_prompt,
    })),
  };
}
async function runOne(card) {
  if (!workflowId.value) {
    ElMessage.error('先选择反推工作流');
    return;
  }
  try {
    const data = await request(`/projects/${projectId}/captions/${card.id}/run`, {
      method: 'post',
      data: {
        workflow_id: workflowId.value,
        shared_prompt: shared.value,
        extra_prompt: card.extra_prompt,
        update_shared: true,
      },
    });
    applyBoard(data, false);
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function runEmpty() {
  if (!workflowId.value) {
    ElMessage.error('先选择反推工作流');
    return;
  }
  try {
    const data = await request(`/projects/${projectId}/captions/run-empty`, {
      method: 'post',
      data: {
        workflow_id: workflowId.value,
        shared_prompt: shared.value,
        update_shared: true,
        cards: cards.value.map(item => ({ id: item.id, extra_prompt: item.extra_prompt })),
      },
    });
    applyBoard(data, false);
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function save() {
  saving.value = true;
  try {
    const data = await request(`/projects/${projectId}/captions`, { method: 'put', data: payload() });
    applyBoard(data, true);
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
async function removeCard(card) {
  try {
    await ElMessageBox.confirm(`移除「${card.original_name || '这条素材'}」？`, '移除', { type: 'warning' });
  } catch {
    return;
  }
  try {
    const data = await request(`/projects/${projectId}/captions/${card.id}`, { method: 'delete' });
    applyBoard(data, false);
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(async () => {
  try {
    await load(true);
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
});
onUnmounted(stop);
</script>

<style scoped>
.caption-progress { display: grid; gap: 4px; min-width: 220px; color: #5c6b62; font-size: 12px; }
.caption-page { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.caption-page__scroll { flex: 1; min-height: 0; overflow: auto; }
.caption-page__dock {
  flex: none;
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  background: linear-gradient(rgba(246, 248, 246, 0), #f6f8f6 28%);
}
.caption-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 12px;
  min-width: 0;
}
.caption-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  padding: 12px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgba(47, 138, 91, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
}
.caption-card > * { min-width: 0; max-width: 100%; }
.caption-card header { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.caption-card header strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caption-card header span { flex: none; display: inline-flex; align-items: center; gap: 4px; }
.caption-card img, .caption-card video {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 180px;
  object-fit: contain;
  background: #f3f6f4;
  border-radius: 8px;
}
.caption-card :deep(.el-textarea),
.caption-card :deep(.el-textarea__inner) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.caption-card__error { margin: 0; color: #c45656; font-size: 12px; overflow-wrap: anywhere; }
</style>
