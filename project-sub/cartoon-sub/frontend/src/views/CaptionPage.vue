<template>
  <PageShell title="提示词反推" :loading="loading && !ready">
    <template #extra>
      <div v-if="job.active" class="caption-progress">
        <span>总进度 {{ job.done || 0 }}/{{ job.total || 0 }}</span>
        <el-progress :percentage="job.percent || 0" :format="formatPercent" :indeterminate="job.waiting" :stroke-width="8" color="#2f8a5b" />
        <span>{{ job.note }}</span>
      </div>
      <el-button :disabled="!canMake() || !projectId || !workflowId" @click="runEmpty">一键执行</el-button>
      <el-button type="danger" plain :disabled="!canMake() || !job.active" :loading="stopping" @click="stopJob">停止</el-button>
      <el-button-group>
        <el-button :disabled="!canMake() || !projectId || job.active || !hasPrompt" :loading="clearing" @click="clearPrompts">一键清除</el-button>
        <el-button type="danger" :disabled="!canMake() || !projectId || job.active || !cards.length" :loading="deleting" @click="deleteCards">一键删除</el-button>
      </el-button-group>
      <el-button link type="primary" @click="back">返回提示词</el-button>
    </template>
    <div class="caption-page">
      <div class="caption-page__scroll">
        <section class="cartoon-module">
          <el-form label-position="top">
            <el-form-item label="项目">
              <el-select :model-value="projectId" filterable placeholder="选择项目" style="width: 100%" @change="onProject">
                <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="String(item.id)" />
              </el-select>
            </el-form-item>
            <el-form-item label="反推工作流">
              <el-select v-model="workflowId" filterable placeholder="选择反推工作流" style="width: 100%">
                <el-option v-for="item in workflows" :key="item.id" :label="workflowLabel(item)" :value="item.id" />
              </el-select>
              <p v-if="workflowsError" class="cartoon-module__hint">{{ workflowsError }}</p>
              <p class="cartoon-module__hint">图片和视频要各自选对应的工作流。一键执行只跑提示词还空着、且和当前工作流类型一致的卡片。</p>
            </el-form-item>
            <div class="caption-relation">
              <p>输出上限和真实帧率各管一件事，互不影响。</p>
              <p>输出上限是模型这次最多新写的 token。写满就停，句子可以停在半截。它不改变看了几帧。</p>
              <p>真实帧率只用于视频。片子整段解码，再均匀抽 16 帧。时间戳用原始帧号除以帧率，模型看到的时长 = 总帧数 / 帧率。留空就把文件里的帧率接上。12 秒、30 帧/秒的片子留空或填 30，时间轴仍约 12 秒。以前把抽到的 16 帧当成 24 帧/秒，最后一个时间戳会变成 0.6 秒。</p>
            </div>
            <el-form-item label="输出上限">
              <el-input-number
                v-model="maxTokens"
                :min="limitMin"
                :max="limitMax"
                :step="1"
                :precision="0"
                :controls="false"
                :disabled="!limitOn"
              />
              <p class="cartoon-module__hint">{{ limitOn ? `写满就停。这条工作流可填 ${limitMin} 到 ${limitMax}。` : '当前工作流没有句子长度，这项不生效。' }}</p>
            </el-form-item>
            <el-form-item label="真实帧率">
              <el-input v-model="videoFps" :disabled="!fpsOn" placeholder="留空使用文件真实帧率" />
              <p class="cartoon-module__hint">{{ fpsOn ? '留空就把文件帧率接上。填写后改用这个数。时长 = 总帧数 / 帧率。' : '图片反推不使用帧率。换成视频工作流后，留空即用文件帧率。' }}</p>
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
                <el-button type="primary" plain :disabled="!projectId" :loading="uploading">批量上传</el-button>
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
                <el-button size="small" type="primary" :disabled="!canMake() || !projectId || busy(card)" @click="runOne(card)">执行</el-button>
              </span>
            </header>
            <VideoWithRate v-if="card.media_kind === 'video'" :src="fileUrl(card)" muted controls preload="metadata" />
            <img v-else :src="fileUrl(card)" alt="" />
            <el-input v-model="card.extra_prompt" type="textarea" :rows="2" placeholder="单独补充提示，可以不填" />
            <el-input v-model="card.result_prompt" type="textarea" :rows="5" placeholder="生成的提示词" />
            <div v-if="card.status === 'running'" class="caption-card__progress">
              <el-progress :percentage="cardPercent(card)" :indeterminate="!card.progress_max" :stroke-width="8" color="#2f8a5b" />
              <span>{{ cardNote(card) }}</span>
              <span v-if="card.progress_max > 0 && card.progress_value + 1 >= card.progress_max">模型正在写提示词，这一步结束前进度会停在这里。</span>
            </div>
            <p v-else-if="card.status === 'queued'" class="cartoon-module__hint">排队，等上一条拿到提示词</p>
            <p v-else-if="card.error_message" class="caption-card__error">{{ card.error_message }}</p>
          </article>
        </div>
      </div>
      <div class="caption-page__dock">
        <el-button type="primary" :disabled="!canMake() || !projectId" :loading="saving" @click="save">保存</el-button>
      </div>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import VideoWithRate from '../components/VideoWithRate.vue';

const route = useRoute();
const router = useRouter();
const projects = ref([]);
const projectId = computed(() => String(route.query.project || route.params.id || ''));
const loading = ref(true);
const ready = ref(false);
const uploading = ref(false);
const saving = ref(false);
const clearing = ref(false);
const deleting = ref(false);
const stopping = ref(false);
const workflows = ref([]);
const workflowsError = ref('');
const workflowId = ref(null);
const maxTokens = ref(2048);
const videoFps = ref('');
const shared = ref('');
const picked = computed(() => workflows.value.find(item => item.id === workflowId.value) || null);
const limitOn = computed(() => !picked.value || Number(picked.value.outputMax) > 0);
const fpsOn = computed(() => !picked.value || Boolean(picked.value.usesFps));
const limitMin = computed(() => Number(picked.value?.outputMin) || 64);
const limitMax = computed(() => Number(picked.value?.outputMax) || 4096);
const cards = ref([]);
const hasPrompt = computed(() => cards.value.some(item => String(item.result_prompt || '').trim()));
const job = ref({ active: false, waiting: false, percent: 0, note: '' });
const queue = [];
let pumping = false;
let timer = null;

function workflowLabel(item) {
  return `${item.name} · ${item.media === 'video' ? '视频' : '图片'}`;
}
function fileUrl(card) {
  return `${resolveApiBase()}/projects/${projectId.value}/captions/${card.id}/file`;
}
function busy(card) {
  return card.status === 'queued' || card.status === 'running';
}
function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}
function cardPercent(card) {
  return Math.min(100, Math.max(0, Number(card.progress_percent) || 0));
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
    maxTokens.value = Number(data?.max_tokens) || 2048;
    videoFps.value = data?.video_fps == null ? '' : String(data.video_fps);
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
  const data = await request(`/projects/${projectId.value}/captions`);
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
  router.push('/skills/prompts');
}
function onProject(id) {
  router.replace({ path: '/skills/prompts/reverse', query: { project: String(id) } });
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
  if (!projectId.value) {
    ElMessage.warning('先选择项目');
    queue.length = 0;
    return;
  }
  pumping = true;
  uploading.value = true;
  try {
    while (queue.length) {
      const file = queue.shift();
      const data = await readFile(file);
      const saved = await request(`/projects/${projectId.value}/captions/files`, {
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
    max_tokens: maxTokens.value,
    video_fps: videoFps.value,
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
    const data = await request(`/projects/${projectId.value}/captions/${card.id}/run`, {
      method: 'post',
      data: {
        workflow_id: workflowId.value,
        shared_prompt: shared.value,
        extra_prompt: card.extra_prompt,
        max_tokens: maxTokens.value,
        video_fps: videoFps.value,
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
    const data = await request(`/projects/${projectId.value}/captions/run-empty`, {
      method: 'post',
      data: {
        workflow_id: workflowId.value,
        shared_prompt: shared.value,
        max_tokens: maxTokens.value,
        video_fps: videoFps.value,
        update_shared: true,
        cards: cards.value.map(item => ({ id: item.id, extra_prompt: item.extra_prompt })),
      },
    });
    applyBoard(data, false);
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function stopJob() {
  try {
    await ElMessageBox.confirm('停止当前反推？正在跑的会中断，排队的也会取消。', '停止', {
      type: 'warning',
      confirmButtonText: '停止',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  stopping.value = true;
  try {
    const data = await request(`/projects/${projectId.value}/captions/stop`, { method: 'post' });
    applyBoard(data, false);
    ElMessage.success('已停止');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    stopping.value = false;
  }
}
async function save() {
  saving.value = true;
  try {
    const data = await request(`/projects/${projectId.value}/captions`, { method: 'put', data: payload() });
    applyBoard(data, true);
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
async function clearPrompts() {
  try {
    await ElMessageBox.confirm('清空全部卡片里已经生成的提示词？图片和视频会保留。', '一键清除', {
      type: 'warning',
      confirmButtonText: '清空提示词',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  clearing.value = true;
  try {
    const data = await request(`/projects/${projectId.value}/captions/clear-prompts`, { method: 'post' });
    applyBoard(data, false);
    const server = new Map((data?.cards || []).map(item => [ item.id, item.result_prompt || '' ]));
    cards.value = cards.value.map(item => {
      const text = server.has(item.id) ? server.get(item.id) : '';
      return { ...item, result_prompt: text, _serverResult: text };
    });
    ElMessage.success('已清空提示词');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    clearing.value = false;
  }
}
async function deleteCards() {
  try {
    await ElMessageBox.confirm('删除全部卡片？图片、视频和提示词都会去掉，不能恢复。', '一键删除', {
      type: 'warning',
      confirmButtonText: '删除全部',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  deleting.value = true;
  try {
    const data = await request(`/projects/${projectId.value}/captions`, { method: 'delete' });
    applyBoard(data, false);
    ElMessage.success('已删除全部卡片');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    deleting.value = false;
  }
}
async function removeCard(card) {
  try {
    await ElMessageBox.confirm(`移除「${card.original_name || '这条素材'}」？`, '移除', { type: 'warning' });
  } catch {
    return;
  }
  try {
    const data = await request(`/projects/${projectId.value}/captions/${card.id}`, { method: 'delete' });
    applyBoard(data, false);
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(async () => {
  try {
    projects.value = await request('/projects') || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
});
watch(projectId, async id => {
  stop();
  if (!id) {
    cards.value = [];
    ready.value = true;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await load(true);
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
}, { immediate: true });
onUnmounted(stop);
</script>

<style scoped>
.caption-relation {
  display: grid;
  gap: 6px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f3f7f4;
  color: #243028;
  font-size: 13px;
  line-height: 1.55;
}
.caption-relation p { margin: 0; }
.caption-progress { display: grid; gap: 4px; min-width: 240px; color: #5c6b62; font-size: 12px; }
.caption-card__progress { display: grid; gap: 4px; min-width: 0; color: #5c6b62; font-size: 12px; }
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
.caption-card img,
.caption-card :deep(.video-with-rate video) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
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
