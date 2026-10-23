<template>
  <div v-if="project" class="cartoon-workbench">
    <aside class="cartoon-workbench__nav">
      <el-button link type="primary" @click="router.push(`/projects/${projectId}`)">← 返回项目</el-button>
      <h1>{{ project.name }}</h1>
      <p>{{ episodeTitle }}</p>
      <p v-if="pinLabel" class="cartoon-workbench__pin">{{ pinLabel }}</p>
      <button
        v-for="item in nodes"
        :key="item.id"
        type="button"
        class="cartoon-workbench__node"
        :class="{ 'is-active': node === item.id }"
        @click="selectNode(item.id)"
      >
        <i class="cartoon-workbench__dot" :class="`is-${nodeMark(item.id)}`" />
        {{ item.title }}
      </button>
    </aside>
    <main class="cartoon-workbench__main">
      <ProjectDetailPage v-if="scriptStep" :forced-step="scriptStep" />
      <section v-else-if="node === 'assets'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">资产</h3>
        <p class="cartoon-module__hint">角色可以登记参考图路径。配音登记音色、语速和情绪。</p>
        <el-form inline>
          <el-input v-model="assetForm.name" placeholder="名称" style="width: 140px" />
          <el-select v-model="assetForm.kind" style="width: 110px">
            <el-option label="角色" value="character" />
            <el-option label="场景" value="scene" />
            <el-option label="道具" value="prop" />
            <el-option label="配音" value="voice" />
          </el-select>
          <el-input v-model="assetForm.description" placeholder="描述" style="width: 180px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.reference_path" placeholder="参考图路径" style="width: 180px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.voice_key" placeholder="音色标识" style="width: 120px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.speech_rate" placeholder="语速" style="width: 80px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.emotion" placeholder="情绪" style="width: 80px" />
          <el-button type="primary" @click="addAsset">添加</el-button>
        </el-form>
        <el-empty v-if="!assets.length" description="还没有资产" />
        <el-table v-else :data="assets" size="small">
          <el-table-column label="类型" width="80">
            <template #default="{ row }">{{ assetKind(row.kind) }}</template>
          </el-table-column>
          <el-table-column prop="name" label="名称" width="140" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="reference_path" label="参考图" />
          <el-table-column prop="voice_key" label="音色" />
        </el-table>
      </section>
      <template v-else-if="node === 'generate' || node === 'preview'">
        <section v-if="!shotQuery" class="cartoon-module cartoon-workbench__note">
          <h3 class="cartoon-module__title">选择分镜</h3>
          <el-empty v-if="!shots.length" description="还没有分镜">
            <el-button type="primary" @click="selectNode('storyboard')">去分镜</el-button>
          </el-empty>
          <el-table v-else :data="shots" @row-click="pickShot">
            <el-table-column label="分镜" min-width="220">
              <template #default="{ row }">{{ row.description || `镜头 ${row.id}` }}</template>
            </el-table-column>
            <el-table-column prop="shot_size" label="景别" width="100" />
            <el-table-column prop="camera_move" label="运镜" width="100" />
          </el-table>
        </section>
        <ShotGeneratePage v-else-if="node === 'generate'" :key="`generate-${shotQuery}`" />
        <ShotOutputsPage v-else :key="`preview-${shotQuery}`" />
      </template>
      <template v-else-if="node === 'compose' || node === 'export'">
        <p v-if="node === 'export'" class="cartoon-module__hint cartoon-workbench__note">导出使用本页右上角「导出成片」。字幕和背景音乐这一期不会烧进成片。</p>
        <ProjectEditPage />
      </template>
    </main>
    <aside class="cartoon-workbench__side">
      <h2>这一集</h2>
      <p>类型 · {{ typeName }}</p>
      <p>画面 · {{ project.visual_style || '未选' }}</p>
      <p>钉扎 · {{ pinLabel || '未选择故事包' }}</p>
      <p>节点 · {{ nodeTitle }}</p>
    </aside>
  </div>
  <p v-else class="cartoon-module__hint cartoon-workbench__note">{{ error || '正在打开工作台…' }}</p>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ProjectDetailPage from './ProjectDetailPage.vue';
import ShotGeneratePage from './ShotGeneratePage.vue';
import ShotOutputsPage from './ShotOutputsPage.vue';
import ProjectEditPage from './ProjectEditPage.vue';
import { request } from '../services/apiConfig.js';

const nodes = [
  { id: 'input', title: '输入与绑定' },
  { id: 'script', title: '脚本' },
  { id: 'storyboard', title: '分镜' },
  { id: 'assets', title: '资产' },
  { id: 'generate', title: '生成' },
  { id: 'compose', title: '合成' },
  { id: 'preview', title: '预览' },
  { id: 'export', title: '导出' },
];
const stepByNode = { input: 1, script: 2, storyboard: 3 };

const route = useRoute();
const router = useRouter();
const project = ref(null);
const bundle = ref(null);
const episode = ref(null);
const shots = ref([]);
const error = ref('');
const assetForm = reactive({ name: '', kind: 'character', description: '', reference_path: '', voice_key: '', speech_rate: '', emotion: '' });
const assets = computed(() => bundle.value?.assets || []);
const nodeTitle = computed(() => nodes.find(item => item.id === node.value)?.title || '');

const projectId = computed(() => route.params.id);
const node = computed(() => {
  const value = String(route.query.node || episode.value?.current_node || 'input');
  return nodes.some(item => item.id === value) ? value : 'input';
});
const scriptStep = computed(() => stepByNode[node.value] || 0);
const shotQuery = computed(() => String(route.query.shot || ''));
const episodeTitle = computed(() => episode.value?.title || '第1集');
const typeName = computed(() => ({
  ai_comic: '漫剧',
  ai_short: '短剧',
  ai_science: '科普',
  ai_commerce: '电商',
}[project.value?.content_type] || '漫剧'));
const pinLabel = computed(() => {
  if (project.value?.package_version) return `故事包 v${project.value.package_version}`;
  if (project.value?.pin_mode === 'legacy') return '未钉扎';
  if (project.value?.pin_mode === 'local') return '本地文案';
  return '';
});

function assetKind(kind) {
  return { character: '角色', scene: '场景', prop: '道具', voice: '配音' }[kind] || kind;
}
function nodeMark(id) {
  const tasks = bundle.value?.tasks || [];
  const imports = (bundle.value?.imports || []).filter(item => !item.deleted_at);
  if (id === 'input') {
    if (project.value?.package_version) return 'ok';
    if (project.value?.pin_mode === 'local') return 'ok';
    if (project.value?.pin_mode === 'legacy') return 'warn';
    return 'idle';
  }
  if (id === 'script') {
    if (project.value?.content_type === 'ai_science' || project.value?.content_type === 'ai_commerce') return (bundle.value?.copy_blocks || []).length ? 'ok' : 'idle';
    return imports.length ? 'ok' : 'idle';
  }
  if (id === 'storyboard') return shots.value.length ? 'ok' : 'idle';
  if (id === 'assets') return assets.value.length ? 'ok' : 'idle';
  if (id === 'generate' || id === 'preview') {
    const latest = tasks[0];
    if (!latest) return 'idle';
    if ([ 'pending', 'queued', 'running', 'saving' ].includes(latest.status)) return 'run';
    if (latest.status === 'failed') return 'bad';
    if (latest.status === 'success') return 'ok';
  }
  return 'idle';
}
async function addAsset() {
  const name = assetForm.name.trim();
  if (!name) return;
  await request(`/projects/${projectId.value}/assets`, {
    method: 'post',
    data: {
      name,
      kind: assetForm.kind,
      description: assetForm.description,
      reference_path: assetForm.reference_path,
      voice_key: assetForm.voice_key,
      speech_rate: assetForm.speech_rate,
      emotion: assetForm.emotion,
    },
  });
  assetForm.name = '';
  assetForm.description = '';
  assetForm.reference_path = '';
  assetForm.voice_key = '';
  assetForm.speech_rate = '';
  assetForm.emotion = '';
  await load();
}
function selectNode(id) {
  const query = { node: id };
  if ((id === 'generate' || id === 'preview') && route.query.shot) query.shot = String(route.query.shot);
  router.replace({ query });
}
function pickShot(row) {
  router.replace({ query: { node: node.value, shot: String(row.id) } });
}
async function persistNode(value) {
  if (!episode.value || !value || episode.value.current_node === value) return;
  try {
    const saved = await request(`/projects/${projectId.value}/tasks/${episode.value.id}`, {
      method: 'PUT',
      data: { current_node: value },
    });
    episode.value = { ...episode.value, current_node: saved?.current_node || value };
  } catch {
    // 地址栏仍是当前节点，记不住时下次打开回到上次成功写入的节点
  }
}
async function load() {
  error.value = '';
  const detail = await request(`/projects/${projectId.value}`);
  const episodes = detail.episodes || [];
  if (!episodes.length) {
    error.value = '还没有这一集';
    return;
  }
  const current = episodes.find(item => String(item.id) === String(route.params.taskId));
  if (!current) {
    await router.replace({ path: `/projects/${projectId.value}/tasks/${episodes[0].id}`, query: route.query });
    return;
  }
  project.value = detail.project;
  bundle.value = detail;
  episode.value = current || null;
  shots.value = (detail.shots || []).filter(item => !item.deleted_at);
  if (episode.value && !route.query.node && episode.value.current_node) {
    await router.replace({ query: { ...route.query, node: episode.value.current_node } });
  }
  await persistNode(node.value);
}

watch(node, (value) => { persistNode(value); });
watch(() => route.params.taskId, () => {
  load().catch((err) => { error.value = err.message || '打不开工作台'; });
});
onMounted(() => {
  load().catch((err) => { error.value = err.message || '打不开工作台'; });
});
</script>

<style scoped>
.cartoon-workbench {
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 168px;
  min-height: 100%;
  align-items: start;
}
.cartoon-workbench__nav {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
}
.cartoon-workbench__nav h1 {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--cartoon-color-deep);
}
.cartoon-workbench__nav p {
  margin: 0 0 8px;
  color: var(--cartoon-color-muted);
  font-size: 13px;
}
.cartoon-workbench__pin { margin-bottom: 12px; }
.cartoon-workbench__node {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--cartoon-color-deep);
}
.cartoon-workbench__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c5d1c9;
  flex: none;
}
.cartoon-workbench__dot.is-ok { background: #2f8a5b; }
.cartoon-workbench__dot.is-warn { background: #c48a2a; }
.cartoon-workbench__dot.is-bad { background: #c44b4b; }
.cartoon-workbench__dot.is-run { background: #3b7fc4; }
.cartoon-workbench__side {
  position: sticky;
  top: 0;
  padding: 16px 12px;
  color: var(--cartoon-color-muted);
  font-size: 13px;
}
.cartoon-workbench__side h2 {
  margin: 0 0 8px;
  color: var(--cartoon-color-deep);
  font-size: 14px;
}
.cartoon-workbench__side p { margin: 0 0 6px; }
.cartoon-workbench__node.is-active {
  background: #fff;
  color: var(--cartoon-color-primary);
  font-weight: 600;
}
.cartoon-workbench__main { min-width: 0; }
.cartoon-workbench__note { margin: 16px 20px 0; }
.cartoon-workbench__main :deep(.cartoon-page) { padding-top: 12px; }
</style>
