<template>
  <section class="cartoon-module">
    <div class="caption-board__head">
      <h3 class="cartoon-module__title">提示词</h3>
      <el-button type="primary" plain @click="router.push(`/projects/${projectId}/captions`)">获取提示词</el-button>
    </div>
    <p v-if="job.active" class="cartoon-module__hint">{{ job.note }}。离开页面后会继续，回到获取提示词页可以看进度。</p>
    <el-empty v-if="!loading && !cards.length" description="还没有保存的提示词" />
    <div v-else class="caption-grid">
      <article v-for="card in cards" :key="card.id" class="caption-card">
        <header>
          <strong>{{ card.original_name || (card.media_kind === 'video' ? '视频' : '图片') }}</strong>
          <el-button size="small" @click="open(card)">编辑</el-button>
        </header>
        <video v-if="card.media_kind === 'video'" :src="fileUrl(card)" muted controls preload="metadata"></video>
        <img v-else :src="fileUrl(card)" alt="" />
        <p class="caption-card__label">{{ card.extra_prompt?.trim() ? '单独补充提示' : '补充提示' }}</p>
        <p class="caption-card__text">{{ shownExtra(card) || '没有补充提示' }}</p>
        <p class="caption-card__label">提示词</p>
        <p class="caption-card__text">{{ card.result_prompt || '还没有提示词' }}</p>
      </article>
    </div>
    <el-drawer v-model="drawer" title="提示词详情" size="480px" append-to-body>
      <div v-if="current" class="caption-drawer">
        <video v-if="current.media_kind === 'video'" :src="fileUrl(current)" controls></video>
        <img v-else :src="fileUrl(current)" alt="" />
        <p class="caption-card__label">公共补充提示</p>
        <p class="caption-card__text">{{ current.shared_extra || '生成时没有公共补充提示' }}</p>
        <p class="caption-card__label">单独补充提示</p>
        <el-input v-model="draft.extra_prompt" type="textarea" :rows="3" placeholder="可以不填。填写后执行会用这一段" />
        <p class="caption-card__label">工作流</p>
        <p class="caption-card__text">{{ current.workflow_name || '还没有执行过' }}</p>
        <p class="caption-card__label">提示词</p>
        <el-input v-model="draft.result_prompt" type="textarea" :rows="8" />
        <p v-if="current.status === 'running' || current.status === 'queued'" class="cartoon-module__hint">{{ job.note || '正在反推' }}</p>
        <p v-else-if="current.error_message" class="caption-card__error">{{ current.error_message }}</p>
      </div>
      <template #footer>
        <el-button :disabled="!canMake() || !current?.workflow_id || busy" @click="run">执行</el-button>
        <el-button type="primary" :disabled="!canMake()" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-drawer>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
});
const router = useRouter();
const loading = ref(true);
const cards = ref([]);
const job = ref({ active: false, waiting: false, percent: 0, note: '' });
const drawer = ref(false);
const current = ref(null);
const saving = ref(false);
const draft = reactive({ extra_prompt: '', result_prompt: '' });
let timer = null;
const busy = ref(false);

function fileUrl(card) {
  return `${resolveApiBase()}/projects/${props.projectId}/captions/${card.id}/file`;
}
function shownExtra(card) {
  return String(card.extra_prompt || '').trim() || String(card.shared_extra || '').trim();
}
function apply(data) {
  const rows = data?.cards || [];
  cards.value = rows.filter(item => item.saved);
  job.value = data?.job || { active: false, waiting: false, percent: 0, note: '' };
  if (current.value) {
    const next = rows.find(item => item.id === current.value.id);
    if (next) {
      const keepResult = draft.result_prompt !== (current.value.result_prompt || '');
      const keepExtra = draft.extra_prompt !== (current.value.extra_prompt || '');
      current.value = next;
      busy.value = next.status === 'queued' || next.status === 'running';
      if (!keepResult) draft.result_prompt = next.result_prompt || '';
      if (!keepExtra) draft.extra_prompt = next.extra_prompt || '';
    }
  }
  if (job.value.active) follow();
  else stop();
}
async function load() {
  const data = await request(`/projects/${props.projectId}/captions`);
  apply(data);
}
function follow() {
  if (timer) return;
  timer = setInterval(() => { load().catch(() => {}); }, 1500);
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
function open(card) {
  current.value = card;
  draft.extra_prompt = card.extra_prompt || '';
  draft.result_prompt = card.result_prompt || '';
  busy.value = card.status === 'queued' || card.status === 'running';
  drawer.value = true;
}
async function run() {
  if (!current.value?.workflow_id) {
    ElMessage.error('这条还没有记录工作流');
    return;
  }
  try {
    const data = await request(`/projects/${props.projectId}/captions/${current.value.id}/run`, {
      method: 'post',
      data: {
        workflow_id: current.value.workflow_id,
        extra_prompt: draft.extra_prompt,
        shared_prompt: current.value.shared_extra || '',
      },
    });
    apply(data);
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function save() {
  if (!current.value) return;
  saving.value = true;
  try {
    const data = await request(`/projects/${props.projectId}/captions`, {
      method: 'put',
      data: {
        cards: [{
          id: current.value.id,
          extra_prompt: draft.extra_prompt,
          result_prompt: draft.result_prompt,
        }],
      },
    });
    apply(data);
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  try {
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
});
onUnmounted(stop);
</script>

<style scoped>
.caption-board__head { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.caption-board__head .cartoon-module__title { margin: 0; }
.caption-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 12px;
  margin-top: 12px;
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
.caption-card img, .caption-card video, .caption-drawer img, .caption-drawer video {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 160px;
  object-fit: contain;
  background: #f3f6f4;
  border-radius: 8px;
}
.caption-card__label { margin: 0; color: #5c6b62; font-size: 12px; }
.caption-card__text {
  margin: 0;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.caption-card__error { margin: 0; color: #c45656; font-size: 12px; overflow-wrap: anywhere; }
.caption-drawer { display: grid; gap: 8px; min-width: 0; }
.caption-drawer :deep(.el-textarea),
.caption-drawer :deep(.el-textarea__inner) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
</style>
