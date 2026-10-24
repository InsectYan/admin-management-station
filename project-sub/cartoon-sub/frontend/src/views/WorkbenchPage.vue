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
        <p class="cartoon-module__hint">角色登记编号、三视图路径、表情、服装和 LoRA 引用，这里不生成图片。场景可以登记多角度路径。道具选择分类。配音登记语种和发音人。字幕样式和转场只记名称和说明。停用后记录还在。</p>
        <el-form inline>
          <el-input v-model="assetForm.name" placeholder="名称" style="width: 140px" />
          <el-select v-model="assetForm.kind" style="width: 120px">
            <el-option label="角色" value="character" />
            <el-option label="场景" value="scene" />
            <el-option label="道具" value="prop" />
            <el-option label="配音" value="voice" />
            <el-option label="背景音乐" value="bgm" />
            <el-option label="音效" value="sfx" />
            <el-option label="字幕样式" value="subtitle_style" />
            <el-option label="转场" value="transition" />
          </el-select>
          <el-input v-model="assetForm.description" placeholder="描述" style="width: 180px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.character_id" placeholder="叙事人物编号" style="width: 140px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.consistency_note" placeholder="一致性备注" style="width: 160px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.front_path" placeholder="正面图路径" style="width: 140px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.side_path" placeholder="侧面图路径" style="width: 140px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.back_path" placeholder="背面图路径" style="width: 140px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.expression_note" placeholder="表情" style="width: 120px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.costume_note" placeholder="服装" style="width: 120px" />
          <el-input v-if="assetForm.kind === 'character'" v-model="assetForm.lora_ref" placeholder="LoRA 引用" style="width: 140px" />
          <el-input v-if="assetForm.kind === 'character' || assetForm.kind === 'bgm' || assetForm.kind === 'sfx'" v-model="assetForm.reference_path" :placeholder="assetForm.kind === 'character' ? '参考图路径' : '文件路径'" style="width: 180px" />
          <el-select v-if="assetForm.kind === 'scene'" v-model="assetForm.scene_type" placeholder="场景类型" style="width: 120px">
            <el-option v-for="item in sceneTypes" :key="item" :label="item" :value="item" />
          </el-select>
          <el-input v-if="assetForm.kind === 'scene'" v-model="assetForm.angle_paths" placeholder="多角度路径，一行一个" style="width: 220px" />
          <el-select v-if="assetForm.kind === 'prop'" v-model="assetForm.prop_category" placeholder="道具分类" style="width: 120px">
            <el-option v-for="item in propCategories" :key="item" :label="item" :value="item" />
          </el-select>
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.voice_key" placeholder="音色标识" style="width: 120px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.speech_rate" placeholder="语速" style="width: 80px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.emotion" placeholder="情绪" style="width: 80px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.voice_lang" placeholder="语种" style="width: 100px" />
          <el-input v-if="assetForm.kind === 'voice'" v-model="assetForm.speaker_name" placeholder="发音人" style="width: 100px" />
          <el-button type="primary" @click="addAsset">添加</el-button>
        </el-form>
        <el-empty v-if="!assets.length" description="还没有资产" />
        <el-table v-else :data="assets" size="small">
          <el-table-column label="类型" width="80">
            <template #default="{ row }">{{ assetKind(row.kind) }}</template>
          </el-table-column>
          <el-table-column prop="name" label="名称" width="140" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="character_id" label="人物编号" width="120" />
          <el-table-column prop="scene_type" label="场景类型" width="100" />
          <el-table-column prop="angle_paths" label="多角度" min-width="140" />
          <el-table-column prop="prop_category" label="道具分类" width="100" />
          <el-table-column prop="voice_lang" label="语种" width="80" />
          <el-table-column prop="speaker_name" label="发音人" width="100" />
          <el-table-column label="三视图" min-width="160">
            <template #default="{ row }">{{ [ row.front_path, row.side_path, row.back_path ].filter(Boolean).join(' / ') }}</template>
          </el-table-column>
          <el-table-column prop="reference_path" label="参考图" />
          <el-table-column prop="voice_key" label="音色" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ row.disabled ? '已停用' : '使用中' }}</template>
          </el-table-column>
          <el-table-column label="" width="80">
            <template #default="{ row }">
              <el-button v-if="!row.disabled" link type="danger" @click="disableAsset(row)">停用</el-button>
            </template>
          </el-table-column>
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
        <ExportSpecs v-if="node === 'export'" class="cartoon-workbench__note" :project-id="projectId" />
        <p v-if="node === 'export'" class="cartoon-module__hint cartoon-workbench__note">已有成片仍用本页右上角「导出成片」。下面的规格会重新编码，有台词时烧进画面，长版可以混入背景音乐。</p>
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
import ExportSpecs from '../components/ExportSpecs.vue';
import { request } from '../services/apiConfig.js';
import { isLocalType, typeLabel } from '../lib/contentTypes.js';

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
const sceneTypes = [ '室内', '室外', '城市', '自然', '古风', '品牌' ];
const propCategories = [ '服饰', '器物', '食物', '文书', '交通', '其他' ];
const assetForm = reactive({
  name: '', kind: 'character', description: '', reference_path: '', character_id: '', voice_key: '', speech_rate: '', emotion: '',
  consistency_note: '', scene_type: '', front_path: '', side_path: '', back_path: '', expression_note: '', costume_note: '', lora_ref: '',
  angle_paths: '', prop_category: '', voice_lang: '', speaker_name: '',
});
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
const typeName = computed(() => typeLabel(project.value?.content_type));
const pinLabel = computed(() => {
  if (project.value?.package_version) return `故事包 v${project.value.package_version}`;
  if (project.value?.pin_mode === 'legacy') return '未钉扎';
  if (project.value?.pin_mode === 'local') return '本地文案';
  if (project.value?.pin_mode === 'optional') return '可以不绑故事包';
  return '';
});

function assetKind(kind) {
  return { character: '角色', scene: '场景', prop: '道具', voice: '配音', bgm: '背景音乐', sfx: '音效', subtitle_style: '字幕样式', transition: '转场' }[kind] || kind;
}
function nodeMark(id) {
  const tasks = bundle.value?.tasks || [];
  const imports = (bundle.value?.imports || []).filter(item => !item.deleted_at);
  if (id === 'input') {
    if (project.value?.package_version) return 'ok';
    if (project.value?.pin_mode === 'local' || project.value?.pin_mode === 'optional') return 'ok';
    if (project.value?.pin_mode === 'legacy') return 'warn';
    return 'idle';
  }
  if (id === 'script') {
    if (isLocalType(project.value?.content_type)) return (bundle.value?.copy_blocks || []).length ? 'ok' : 'idle';
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
      character_id: assetForm.character_id,
      voice_key: assetForm.voice_key,
      speech_rate: assetForm.speech_rate,
      emotion: assetForm.emotion,
      consistency_note: assetForm.consistency_note,
      scene_type: assetForm.scene_type,
      front_path: assetForm.front_path,
      side_path: assetForm.side_path,
      back_path: assetForm.back_path,
      expression_note: assetForm.expression_note,
      costume_note: assetForm.costume_note,
      lora_ref: assetForm.lora_ref,
      angle_paths: assetForm.angle_paths,
      prop_category: assetForm.prop_category,
      voice_lang: assetForm.voice_lang,
      speaker_name: assetForm.speaker_name,
    },
  });
  assetForm.name = '';
  assetForm.description = '';
  assetForm.reference_path = '';
  assetForm.character_id = '';
  assetForm.voice_key = '';
  assetForm.speech_rate = '';
  assetForm.emotion = '';
  assetForm.consistency_note = '';
  assetForm.scene_type = '';
  assetForm.front_path = '';
  assetForm.side_path = '';
  assetForm.back_path = '';
  assetForm.expression_note = '';
  assetForm.costume_note = '';
  assetForm.lora_ref = '';
  assetForm.angle_paths = '';
  assetForm.prop_category = '';
  assetForm.voice_lang = '';
  assetForm.speaker_name = '';
  await load();
}
async function disableAsset(row) {
  await request(`/projects/${projectId.value}/assets/${row.id}/disable`, { method: 'post' });
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
