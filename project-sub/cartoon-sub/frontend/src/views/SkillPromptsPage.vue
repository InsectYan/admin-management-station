<template>
  <PageShell title="提示词" :loading="loading">
    <template #extra>
      <el-button type="primary" @click="router.push('/skills/prompts/reverse')">获取提示词</el-button>
    </template>
    <div class="cartoon-toolbar">
      <el-select v-model="projectId" clearable filterable placeholder="按项目筛选" style="width: 240px">
        <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>
    <el-empty v-if="!filtered.length" description="还没有保存的提示词" />
    <div v-else class="caption-grid">
      <article v-for="card in filtered" :key="card.id" class="caption-card">
        <header>
          <strong>{{ card.original_name || (card.media_kind === 'video' ? '视频' : '图片') }}</strong>
          <el-button size="small" @click="open(card)">编辑</el-button>
        </header>
        <p class="caption-card__project">{{ card.project_name || '项目已不在' }}</p>
        <VideoWithRate v-if="card.media_kind === 'video'" :src="fileUrl(card)" muted controls preload="metadata" />
        <img v-else :src="fileUrl(card)" alt="" />
        <p class="caption-card__label">补充提示</p>
        <p class="caption-card__text">{{ shownExtra(card) || '没有补充提示' }}</p>
        <p class="caption-card__label">提示词</p>
        <p class="caption-card__text">{{ card.result_prompt || '还没有提示词' }}</p>
      </article>
    </div>

    <el-drawer v-model="drawer" title="提示词详情" size="480px" append-to-body>
      <div v-if="current" class="caption-drawer">
        <video v-if="current.media_kind === 'video'" :src="fileUrl(current)" controls></video>
        <img v-else :src="fileUrl(current)" alt="" />
        <p class="caption-card__label">项目</p>
        <p class="caption-card__text">{{ current.project_name || '项目已不在' }}</p>
        <p class="caption-card__label">单独补充提示</p>
        <el-input v-model="draft.extra_prompt" type="textarea" :rows="3" placeholder="可以不填" />
        <p class="caption-card__label">工作流</p>
        <p class="caption-card__text">{{ current.workflow_name || '还没有执行过' }}</p>
        <p class="caption-card__label">提示词</p>
        <el-input v-model="draft.result_prompt" type="textarea" :rows="8" />
        <p v-if="current.error_message" class="caption-card__error">{{ current.error_message }}</p>
      </div>
      <template #footer>
        <el-button :disabled="!canMake() || !current?.workflow_id || current?.project_deleted" @click="run">执行</el-button>
        <el-button type="primary" :disabled="!canMake() || current?.project_deleted" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-drawer>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import VideoWithRate from '../components/VideoWithRate.vue';
import { useRegionLoad } from '../lib/useRegionLoad.js';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const router = useRouter();
const rows = ref([]);
const projectId = ref(null);
const drawer = ref(false);
const current = ref(null);
const saving = ref(false);
const draft = reactive({ extra_prompt: '', result_prompt: '' });
const { loading, run: runLoad } = useRegionLoad({ immediate: true });

const projects = computed(() => {
  const map = new Map();
  rows.value.forEach(item => {
    if (!item.project_id || map.has(item.project_id)) return;
    map.set(item.project_id, { id: item.project_id, name: item.project_name || `项目 #${item.project_id}` });
  });
  return [ ...map.values() ];
});
const filtered = computed(() => rows.value.filter(item => !projectId.value || item.project_id === projectId.value));

function fileUrl(card) {
  return `${resolveApiBase()}/projects/${card.project_id}/captions/${card.id}/file`;
}
function shownExtra(card) {
  return String(card.extra_prompt || '').trim() || String(card.shared_extra || '').trim();
}
function open(card) {
  current.value = card;
  draft.extra_prompt = card.extra_prompt || '';
  draft.result_prompt = card.result_prompt || '';
  drawer.value = true;
}
async function load() {
  await runLoad(async () => {
    try {
      rows.value = await request('/library/captions') || [];
    } catch (err) {
      rows.value = [];
      ElMessage.error(err.message);
    }
  });
}
async function run() {
  if (!current.value?.workflow_id) {
    ElMessage.error('这条还没有记录工作流');
    return;
  }
  try {
    await request(`/projects/${current.value.project_id}/captions/${current.value.id}/run`, {
      method: 'post',
      data: {
        workflow_id: current.value.workflow_id,
        extra_prompt: draft.extra_prompt,
        shared_prompt: current.value.shared_extra || '',
      },
    });
    ElMessage.success('已开始反推');
    drawer.value = false;
    router.push({ path: '/skills/prompts/reverse', query: { project: String(current.value.project_id) } });
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function save() {
  if (!current.value) return;
  saving.value = true;
  try {
    await request(`/projects/${current.value.project_id}/captions`, {
      method: 'put',
      data: {
        cards: [{
          id: current.value.id,
          extra_prompt: draft.extra_prompt,
          result_prompt: draft.result_prompt,
        }],
      },
    });
    ElMessage.success('已保存');
    drawer.value = false;
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.caption-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
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
.caption-card img,
.caption-card :deep(.video-with-rate video),
.caption-drawer img,
.caption-drawer video {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 160px;
  object-fit: contain;
  background: #f3f6f4;
  border-radius: 8px;
}
.caption-card__project,
.caption-card__label { margin: 0; color: #5c6b62; font-size: 12px; }
.caption-card__text {
  margin: 0;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.caption-card__error { margin: 0; color: #c45656; font-size: 12px; }
.caption-drawer { display: grid; gap: 8px; min-width: 0; }
</style>
