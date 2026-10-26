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
      <section v-if="customNodes.length || episode?.warning" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">专项检查</h3>
        <p v-if="episode?.warning" class="cartoon-module__hint">{{ episode.warning }}</p>
        <div class="cartoon-toolbar">
          <el-button v-for="item in customNodes" :key="item.node_key" @click="runCustom(item)">运行{{ item.title }}</el-button>
        </div>
        <p v-if="customNote" class="cartoon-module__hint">{{ customNote }}</p>
      </section>
      <ProjectDetailPage v-if="scriptStep" :forced-step="scriptStep" />
      <section v-else-if="node === 'assets'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">资产</h3>
        <p class="cartoon-module__hint">角色登记编号、三视图路径、表情、服装和 LoRA 引用，这里不生成图片。场景可以登记多角度路径。道具选择分类。配音登记语种和发音人。字幕样式和转场只记名称和说明。停用后记录还在。</p>
        <el-form label-position="top" class="cartoon-entry-form" @submit.prevent="addAsset">
          <div class="cartoon-entry-grid">
            <el-form-item label="名称"><el-input v-model="assetForm.name" /></el-form-item>
            <el-form-item label="类型">
              <el-select v-model="assetForm.kind" style="width: 100%">
                <el-option label="角色" value="character" />
                <el-option label="场景" value="scene" />
                <el-option label="道具" value="prop" />
                <el-option label="配音" value="voice" />
                <el-option label="背景音乐" value="bgm" />
                <el-option label="音效" value="sfx" />
                <el-option label="字幕样式" value="subtitle_style" />
                <el-option label="转场" value="transition" />
              </el-select>
            </el-form-item>
            <el-form-item class="is-wide" label="描述">
              <el-input v-model="assetForm.description" type="textarea" :rows="2" />
            </el-form-item>
            <template v-if="assetForm.kind === 'character'">
              <p class="cartoon-entry-label">角色</p>
              <el-form-item label="叙事人物编号"><el-input v-model="assetForm.character_id" /></el-form-item>
              <el-form-item label="一致性备注"><el-input v-model="assetForm.consistency_note" /></el-form-item>
              <el-form-item label="正面图路径"><el-input v-model="assetForm.front_path" /></el-form-item>
              <el-form-item label="侧面图路径"><el-input v-model="assetForm.side_path" /></el-form-item>
              <el-form-item label="背面图路径"><el-input v-model="assetForm.back_path" /></el-form-item>
              <el-form-item label="参考图路径"><el-input v-model="assetForm.reference_path" /></el-form-item>
              <el-form-item label="表情"><el-input v-model="assetForm.expression_note" /></el-form-item>
              <el-form-item label="服装"><el-input v-model="assetForm.costume_note" /></el-form-item>
              <el-form-item class="is-wide" label="LoRA 引用"><el-input v-model="assetForm.lora_ref" /></el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'scene'">
              <p class="cartoon-entry-label">场景</p>
              <el-form-item label="场景类型">
                <el-select v-model="assetForm.scene_type" placeholder="选择类型" style="width: 100%">
                  <el-option v-for="item in sceneTypes" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="多角度路径">
                <el-input v-model="assetForm.angle_paths" type="textarea" :rows="2" placeholder="一行一个路径" />
              </el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'prop'">
              <p class="cartoon-entry-label">道具</p>
              <el-form-item label="道具分类">
                <el-select v-model="assetForm.prop_category" placeholder="选择分类" style="width: 100%">
                  <el-option v-for="item in propCategories" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'voice'">
              <p class="cartoon-entry-label">配音</p>
              <el-form-item label="音色标识"><el-input v-model="assetForm.voice_key" /></el-form-item>
              <el-form-item label="语速"><el-input v-model="assetForm.speech_rate" /></el-form-item>
              <el-form-item label="情绪"><el-input v-model="assetForm.emotion" /></el-form-item>
              <el-form-item label="语种"><el-input v-model="assetForm.voice_lang" /></el-form-item>
              <el-form-item label="发音人"><el-input v-model="assetForm.speaker_name" /></el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'bgm' || assetForm.kind === 'sfx'">
              <el-form-item class="is-wide" label="文件路径"><el-input v-model="assetForm.reference_path" /></el-form-item>
            </template>
          </div>
          <div class="cartoon-entry-actions">
            <el-button type="primary" @click="addAsset">添加</el-button>
          </div>
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
        <p v-if="staleShots.length" class="cartoon-module__hint">资产已更新，这些镜头已经出过画面，不会自动重跑：{{ staleShots.map(item => item.id).join('、') }}</p>
        <el-form label-position="top" class="cartoon-entry-form" @submit.prevent="linkShared">
          <div class="cartoon-entry-grid">
            <el-form-item label="共享资产编号"><el-input v-model="sharedAssetId" /></el-form-item>
          </div>
          <div class="cartoon-entry-actions">
            <el-button @click="linkShared">引用共享资产</el-button>
            <el-button @click="matchAssets">同名匹配</el-button>
            <el-button @click="suggestAssets">请技能建议</el-button>
            <el-button type="primary" :disabled="!assetSuggestions.length" @click="applyAssets">写入绑定</el-button>
          </div>
        </el-form>
        <p v-if="actionNote" class="cartoon-module__hint">{{ actionNote }}</p>
        <el-table v-if="assetSuggestions.length" :data="assetSuggestions" size="small">
          <el-table-column prop="shot_id" label="镜头" width="80" />
          <el-table-column prop="asset_id" label="资产" width="80" />
          <el-table-column prop="reason" label="原因" />
        </el-table>
        <el-table v-if="bindings.length" :data="bindings" size="small">
          <el-table-column prop="shot_id" label="已绑定镜头" width="120" />
          <el-table-column prop="asset_id" label="资产" width="80" />
          <el-table-column prop="reason" label="原因" />
        </el-table>
      </section>
      <section v-else-if="node === 'voice'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">配音</h3>
        <p class="cartoon-module__hint">需要已登记音色，并且配音节点和档位都已启用。建议先出现在这里，确认后才写入时间轴。</p>
        <div class="cartoon-toolbar">
          <el-button @click="suggestVoice">请技能建议</el-button>
          <el-checkbox v-model="requestAudio">档位能出音频时再生成</el-checkbox>
          <el-button type="primary" :disabled="!voiceSuggestions.length" @click="applyVoice">写入时间轴</el-button>
        </div>
        <p v-if="actionNote" class="cartoon-module__hint">{{ actionNote }}</p>
        <el-table v-if="voiceSuggestions.length" :data="voiceSuggestions" size="small">
          <el-table-column prop="shot_id" label="镜头" width="80" />
          <el-table-column prop="text" label="台词" />
          <el-table-column prop="start_ms" label="开始" width="80" />
          <el-table-column prop="end_ms" label="结束" width="80" />
        </el-table>
      </section>
      <section v-else-if="node === 'subtitle'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">字幕</h3>
        <p class="cartoon-module__hint">用镜头台词和已登记的字幕样式排时间轴，不调用技能。节点未启用时不能排。</p>
        <div class="cartoon-toolbar">
          <el-button type="primary" @click="buildSubtitles">按台词排时间轴</el-button>
        </div>
        <p v-if="actionNote" class="cartoon-module__hint">{{ actionNote }}</p>
      </section>
      <section v-else-if="node === 'review'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">AI 初审</h3>
        <p class="cartoon-module__hint">初审只列出问题。通过或驳回仍在人工确认里完成。</p>
        <div class="cartoon-toolbar">
          <el-button @click="suggestReview">请技能建议</el-button>
          <el-button type="primary" :disabled="!reviewSuggestions.length" @click="applyReview">记下问题</el-button>
        </div>
        <p v-if="actionNote" class="cartoon-module__hint">{{ actionNote }}</p>
        <el-table v-if="findings.length" :data="findings" size="small">
          <el-table-column prop="level" label="级别" width="90" />
          <el-table-column prop="message" label="问题" />
          <el-table-column prop="node" label="回到" width="100" />
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
  { id: 'voice', title: '配音' },
  { id: 'subtitle', title: '字幕' },
  { id: 'review', title: '初审' },
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
const bindings = computed(() => bundle.value?.bindings || []);
const staleShots = computed(() => (bundle.value?.shots || []).filter(item => item.asset_stale));
const findings = computed(() => bundle.value?.review_findings || []);
const assetSuggestions = ref([]);
const voiceSuggestions = ref([]);
const reviewSuggestions = ref([]);
const actionNote = ref('');
const customNodes = ref([]);
const customNote = ref('');
const sharedAssetId = ref('');
const requestAudio = ref(false);
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
async function runCustom(item) {
  customNote.value = '';
  try {
    const data = await request(`/projects/${projectId.value}/nodes/${item.node_key}/run`, { method: 'post', data: {} });
    const count = data?.findings?.length || 0;
    customNote.value = data?.warning || data?.note || (count ? `记下 ${count} 条问题` : '这项检查没有发现问题');
    if (data?.warning) await load();
  } catch (err) {
    customNote.value = err.message;
  }
}
async function linkShared() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/assets/link`, {
      method: 'post',
      data: { library_asset_id: Number(sharedAssetId.value) },
    });
    sharedAssetId.value = '';
    actionNote.value = '已引用共享资产';
  });
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
async function runAction(work) {
  actionNote.value = '';
  try {
    await work();
    await load();
  } catch (err) {
    actionNote.value = err.message || '没有完成';
  }
}
async function matchAssets() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/assets/match`, { method: 'post' });
    actionNote.value = '已按名称写入绑定';
  });
}
async function suggestAssets() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/assets/suggest`, { method: 'post' });
    assetSuggestions.value = data?.suggestions || [];
    actionNote.value = assetSuggestions.value.length ? '建议还没有写入' : '没有可绑定的资产';
  });
}
async function applyAssets() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/assets/apply`, { method: 'post', data: { suggestions: assetSuggestions.value } });
    assetSuggestions.value = [];
    actionNote.value = '绑定已写入';
  });
}
async function suggestVoice() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/voice/suggest`, { method: 'post' });
    voiceSuggestions.value = data?.cues || [];
    actionNote.value = '时间轴还没有写入';
  });
}
async function applyVoice() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/voice/apply`, {
      method: 'post',
      data: { cues: voiceSuggestions.value, request_audio: requestAudio.value },
    });
    voiceSuggestions.value = [];
    actionNote.value = data?.audio_note || '时间轴已写入';
  });
}
async function buildSubtitles() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/subtitles/build`, { method: 'post' });
    actionNote.value = data?.style ? `已按「${data.style}」排好字幕` : '已按台词排好字幕';
  });
}
async function suggestReview() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/review-findings/suggest`, { method: 'post' });
    reviewSuggestions.value = data?.issues || [];
    actionNote.value = '问题还没有记下';
  });
}
async function applyReview() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/review-findings/apply`, { method: 'post', data: { issues: reviewSuggestions.value } });
    reviewSuggestions.value = [];
    actionNote.value = '问题已记下';
  });
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
  try {
    const pipe = await request('/pipelines', { params: { content_type: detail.project.content_type } });
    customNodes.value = (pipe.nodes || []).filter(item => item.kind === 'custom' && item.enabled);
  } catch {
    customNodes.value = [];
  }
  if (episode.value && !route.query.node && episode.value.current_node) {
    await router.replace({ query: { ...route.query, node: episode.value.current_node } });
  }
  await persistNode(node.value);
}

watch(node, (value) => {
  actionNote.value = '';
  persistNode(value);
});
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
  gap: 8px;
  margin: 16px 12px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(240, 247, 242, 0.72);
  border: 1px solid rgba(47, 138, 91, 0.12);
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  border: 1px solid rgba(47, 138, 91, 0.12);
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--cartoon-color-muted);
  font-weight: 600;
}
.cartoon-workbench__node:hover {
  background: rgba(255, 255, 255, 0.62);
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
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(47, 138, 91, 0.32);
  color: var(--cartoon-color-deep);
  box-shadow: 0 1px 2px rgba(31, 61, 44, 0.04);
}
.cartoon-workbench__node.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: #2f8a5b;
}
.cartoon-workbench__main { min-width: 0; }
.cartoon-workbench__note { margin: 16px 20px 0; }
.cartoon-workbench__main :deep(.cartoon-page) { padding-top: 12px; }
</style>
