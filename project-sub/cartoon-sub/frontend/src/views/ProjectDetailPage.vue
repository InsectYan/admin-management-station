<template>
  <PageShell v-if="detail" :title="embedded ? '' : detail.project.name">
    <template v-if="!embedded" #extra>
      <el-button link type="primary" @click="router.push(`/projects/${route.params.id}`)">返回详情</el-button>
    </template>
    <el-alert v-if="notice" :title="notice" :type="noticeType" show-icon class="cartoon-module" />
    <FlowSteps v-if="!embedded" :steps="steps" :current="step" @select="step = $event" />

    <section v-show="step === 1" class="cartoon-module">
      <h3 class="cartoon-module__title">项目设定</h3>
      <el-form label-position="top">
        <div class="cartoon-setting-grid">
          <el-form-item label="项目名称">
            <el-input v-model="projectForm.name" />
          </el-form-item>
          <el-form-item v-if="!isScience" label="来源小说">
            <el-select v-model="projectForm.source_novel_id" filterable clearable placeholder="从小说平台选择" style="width: 100%" @change="onNovelChange">
              <el-option v-for="item in novels" :key="item.id" :label="item.title" :value="String(item.id)" />
            </el-select>
          </el-form-item>
          <el-form-item label="画面风格">
            <el-select v-model="projectForm.visual_style" filterable placeholder="选择风格" style="width: 100%">
              <el-option v-for="item in meta.visual_styles" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </div>
        <el-button type="primary" :disabled="!canMake()" @click="saveProject">保存设定</el-button>
      </el-form>
      <NovelBriefPanel v-if="!isScience" :novel="novelBrief" :loading="novelLoading" />
    </section>

    <section v-show="step === 2 && isScience" class="cartoon-module">
      <h3 class="cartoon-module__title">本地文案</h3>
      <CopyBlocks :project-id="route.params.id" />
    </section>

    <section v-show="step === 2 && !isScience">
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">从小说拉取</h3>
        <p class="cartoon-module__hint">新项目按叙事工作台已发布的故事包版本拉取。旧项目仍可直接拉章节，并标记为未钉扎。</p>
        <el-form label-position="top">
          <el-form-item v-if="packageVersions.length" label="故事包版本">
            <el-select v-model="packageVersion" placeholder="选择已发布版本" style="width: 100%" @change="onPackageVersion">
              <el-option v-for="item in packageVersions" :key="item.version" :label="`v${item.version} · ${item.published_at || ''}`" :value="item.version" />
            </el-select>
          </el-form-item>
          <el-alert v-else-if="pinRequired" type="info" show-icon :closable="false" title="还没有已发布的故事包。请先到叙事工作台发布，再回来拉取。" />
          <el-form-item label="章节">
            <el-select v-model="chapterId" filterable placeholder="选择章节" style="width: 100%" :disabled="!projectForm.source_novel_id">
              <el-option v-for="item in pullChapters" :key="item.id" :label="item.label || item.title" :value="String(item.id)" />
            </el-select>
          </el-form-item>
          <el-button type="primary" :disabled="!chapterId || !canMake() || (pinRequired && !packageVersion)" @click="pull">{{ pullLabel }}</el-button>
        </el-form>
      </div>
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">手工快照</h3>
        <el-form label-position="top">
          <el-form-item label="标题"><el-input v-model="chapterTitle" /></el-form-item>
          <el-form-item label="正文"><el-input v-model="body" type="textarea" :rows="6" /></el-form-item>
          <el-button :disabled="!canMake()" @click="saveImport">保存手工快照</el-button>
        </el-form>
      </div>
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">已有快照</h3>
        <el-empty v-if="!liveImports.length" description="还没有章节快照" />
        <el-card v-for="item in liveImports" :key="item.id" shadow="never" class="cartoon-snap">
          <strong>{{ item.chapter_title || '未命名章节' }}</strong>
          <el-tag v-if="item.legacy_unpinned" size="small">未钉扎</el-tag>
          <el-tag v-else-if="item.package_version" size="small" type="success">故事包 v{{ item.package_version }}</el-tag>
          <p>{{ item.body }}</p>
          <p v-if="item.script_data && item.script_data.summary">{{ item.script_data.summary }}</p>
          <div class="cartoon-snap__actions">
            <el-button type="primary" :disabled="!canMake()" :loading="draftingId === item.id" @click="draft(item)">起草分镜</el-button>
            <el-button type="danger" plain :disabled="!canMake()" @click="removeSnapshot(item)">删除快照</el-button>
          </div>
        </el-card>
      </div>
    </section>

    <section v-show="step === 3" class="cartoon-module">
      <h3 class="cartoon-module__title">分镜</h3>
      <div class="cartoon-board">
        <aside class="cartoon-board__snaps">
          <p class="cartoon-board__label">章节快照</p>
          <el-empty v-if="!boardItems.length" description="还没有快照" />
          <button
            v-for="item in boardItems"
            :key="item.key"
            type="button"
            class="cartoon-board__snap"
            :class="{ 'is-active': item.key === selectedImportKey }"
            @click="selectedImportKey = item.key"
          >
            <span class="cartoon-board__snap-title">{{ item.title }}</span>
            <el-tag v-if="item.deleted" type="danger" size="small">已删除</el-tag>
            <el-tag v-else-if="item.removed" type="warning" size="small">上游已移除</el-tag>
            <span class="cartoon-board__snap-count">{{ item.count }} 镜</span>
          </button>
        </aside>
        <div class="cartoon-board__main">
          <div v-if="selectedBoard" class="cartoon-board__head">
            <strong>{{ selectedBoard.title }}</strong>
            <el-tag v-if="selectedBoard.deleted" type="danger" size="small">已删除</el-tag>
            <el-tag v-else-if="selectedBoard.removed" type="warning" size="small">上游已移除</el-tag>
            <el-button
              v-if="selectedBoard.raw"
              type="primary"
              plain
              :disabled="!canMake()"
              :loading="draftingId === selectedBoard.raw.id"
              @click="draft(selectedBoard.raw)"
            >起草分镜</el-button>
          </div>
          <p v-else class="cartoon-module__hint">先在左侧选择一条章节快照。</p>
      <el-form v-if="selectedBoard" label-position="top">
        <el-form-item label="景别">
          <el-select v-model="shot.shot_size" style="width: 220px">
            <el-option v-for="item in meta.shot_sizes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="运镜">
          <el-select v-model="shot.camera_move" style="width: 220px">
            <el-option v-for="item in meta.camera_moves" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="shot.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="提示词"><el-input v-model="shot.positive_zh" type="textarea" :rows="2" /></el-form-item>
        <el-button type="primary" :disabled="!canMake()" @click="addShot">添加分镜</el-button>
      </el-form>
      <el-table v-if="selectedBoard" :data="boardShots" style="margin-top: 12px">
        <el-table-column prop="sort_order" label="#" width="60" />
        <el-table-column label="景别" width="120">
          <template #default="{ row }">
            <el-select v-model="row.shot_size" @change="saveShot(row)">
              <el-option v-for="item in meta.shot_sizes" :key="item" :label="item" :value="item" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="运镜" width="120">
          <template #default="{ row }">
            <el-select v-model="row.camera_move" @change="saveShot(row)">
              <el-option v-for="item in meta.camera_moves" :key="item" :label="item" :value="item" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.upstream_stale" size="small" type="warning">上游已变</el-tag>
            <el-tag v-if="hasOverride(row, 'dialogue')" size="small">台词已改</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述">
          <template #default="{ row }">
            <el-input v-model="row.description" type="textarea" :rows="2" @blur="saveShot(row)" />
          </template>
        </el-table-column>
        <el-table-column label="正向提示词">
          <template #default="{ row }">
            <el-input :model-value="row.prompt?.positive_zh || ''" type="textarea" :rows="2" @update:model-value="setPrompt(row, 'positive_zh', $event)" @blur="saveShot(row)" />
          </template>
        </el-table-column>
        <el-table-column label="负向提示词">
          <template #default="{ row }">
            <el-input :model-value="row.prompt?.negative_zh || ''" type="textarea" :rows="2" @update:model-value="setPrompt(row, 'negative_zh', $event)" @blur="saveShot(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="168" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="!canMake()" @click.stop="openPromote(row)">提升台词</el-button>
            <el-button link type="primary" @click.stop="openOutputs(row)">查看产物</el-button>
          </template>
        </el-table-column>
      </el-table>
        </div>
      </div>
    </section>

    <el-dialog v-model="promoteVisible" title="提升到叙事工作台" width="520px">
      <p class="cartoon-module__hint">原句必须和钉扎版本里的句子一致。应用发生在叙事工作台，这里的生产稿不会被改回去。</p>
      <el-form label-position="top">
        <el-form-item label="原句"><el-input v-model="promoteBefore" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="改后"><el-input v-model="promoteAfter" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="promoteVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canMake()" @click="submitPromote">提交</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import FlowSteps from '../components/FlowSteps.vue';
import NovelBriefPanel from '../components/NovelBriefPanel.vue';
import CopyBlocks from '../components/CopyBlocks.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({ forcedStep: { type: Number, default: 0 } });
const route = useRoute();
const router = useRouter();
const steps = [
  { step: 1, title: '项目' },
  { step: 2, title: '章节' },
  { step: 3, title: '分镜' },
];
const embedded = computed(() => props.forcedStep > 0);
const step = ref(props.forcedStep || Number(route.query.step) || 1);
watch(() => props.forcedStep, (value) => { if (value) step.value = value; });
const detail = ref(null);
const novels = ref([]);
const chapters = ref([]);
const meta = reactive({ visual_styles: [], shot_sizes: [ '中景' ], camera_moves: [ '固定' ] });
const projectForm = reactive({ name: '', source_novel_id: '', visual_style: '' });
const chapterId = ref('');
const packageDesk = ref(null);
const packageVersion = ref(null);
const promoteVisible = ref(false);
const promoteBefore = ref('');
const promoteAfter = ref('');
const promoteShotId = ref(null);
const pinRequired = computed(() => (detail.value?.project?.pin_mode || 'required') !== 'legacy');
const isScience = computed(() => detail.value?.project?.content_type === 'ai_science' || detail.value?.project?.content_type === 'ai_commerce');
const packageVersions = computed(() => packageDesk.value?.versions || []);
const matchingImport = computed(() => (detail.value?.imports || []).find(item => (
  !item.deleted_at && String(item.chapter_id) === String(chapterId.value)
)));
const pullLabel = computed(() => {
  const row = matchingImport.value;
  if (row?.package_version && packageVersion.value && Number(row.package_version) !== Number(packageVersion.value)) {
    return '更新到此版本';
  }
  return '拉取正文';
});
const pullChapters = computed(() => {
  const version = packageVersions.value.find(item => item.version === packageVersion.value);
  if (version?.chapters?.length) {
    return version.chapters.map(item => ({ id: item.chapter_id, title: item.title, label: item.title }));
  }
  return chapters.value;
});
const chapterTitle = ref('');
const body = ref('');
const shot = reactive({ shot_size: '中景', camera_move: '固定', description: '', positive_zh: '' });
const novelBrief = ref(null);
const novelLoading = ref(false);
const draftingId = ref(null);
const selectedImportKey = ref('');
const notice = ref('');
const noticeType = ref('info');

const liveImports = computed(() => (detail.value?.imports || []).filter(item => !item.deleted_at));
const boardItems = computed(() => {
  const imports = detail.value?.imports || [];
  const shots = detail.value?.shots || [];
  const items = imports.map(item => ({
    key: String(item.id),
    importId: item.id,
    title: item.chapter_title || '未命名章节',
    deleted: Boolean(item.deleted_at),
    removed: Boolean(item.upstream_removed),
    count: shots.filter(shotRow => String(shotRow.import_id) === String(item.id)).length,
    raw: item,
  }));
  const orphans = shots.filter(shotRow => shotRow.import_id == null);
  if (orphans.length) {
    items.push({
      key: 'orphan',
      importId: null,
      title: '未关联快照',
      deleted: false,
      count: orphans.length,
      raw: null,
    });
  }
  return items;
});
const selectedBoard = computed(() => boardItems.value.find(item => item.key === selectedImportKey.value) || null);
const boardShots = computed(() => {
  const current = selectedBoard.value;
  if (!current) return [];
  const shots = detail.value?.shots || [];
  if (current.importId == null) return shots.filter(shotRow => shotRow.import_id == null);
  return shots.filter(shotRow => String(shotRow.import_id) === String(current.importId));
});
function ensureBoard() {
  const items = boardItems.value;
  if (!items.length) {
    selectedImportKey.value = '';
    return;
  }
  if (!items.some(item => item.key === selectedImportKey.value)) {
    const live = items.find(item => !item.deleted) || items[0];
    selectedImportKey.value = live.key;
  }
}
function hasOverride(row, field) {
  return Array.isArray(row.overridden_fields) && row.overridden_fields.includes(field);
}
function openGenerate(row) {
  if (embedded.value) {
    router.replace({ query: { node: 'generate', shot: String(row.id) } });
    return;
  }
  router.push({ path: `/projects/${route.params.id}/shots/${row.id}/generate`, query: { from: 'work' } });
}
function openOutputs(row) {
  if (embedded.value) {
    router.replace({ query: { node: 'preview', shot: String(row.id) } });
    return;
  }
  router.push({ path: `/projects/${route.params.id}/shots/${row.id}/outputs`, query: { from: 'work' } });
}
function fillProject() {
  const project = detail.value?.project;
  if (!project) return;
  projectForm.name = project.name || '';
  projectForm.source_novel_id = project.source_novel_id ? String(project.source_novel_id) : '';
  projectForm.visual_style = project.visual_style || '';
}
async function loadChapters(novelId) {
  chapters.value = [];
  if (!novelId) return;
  chapters.value = await request(`/novel-catalog/${novelId}/chapters`).catch(() => []);
}
async function loadNovelBrief(novelId) {
  novelBrief.value = null;
  if (!novelId) return;
  novelLoading.value = true;
  try {
    novelBrief.value = await request(`/novel-catalog/${novelId}`);
  } catch (err) {
    novelBrief.value = null;
    ElMessage.warning(err.message || '小说基础信息没有加载出来');
  } finally {
    novelLoading.value = false;
  }
}
async function loadPackages(novelId) {
  packageDesk.value = null;
  if (!novelId) return;
  try {
    packageDesk.value = await request(`/novel-catalog/${novelId}/packages`);
    if (!packageVersion.value && packageDesk.value?.versions?.length) {
      packageVersion.value = packageDesk.value.versions[0].version;
    }
  } catch {
    packageDesk.value = null;
  }
}
function onPackageVersion() {
  chapterId.value = '';
}
async function onNovelChange() {
  chapterId.value = '';
  packageVersion.value = null;
  await Promise.all([
    loadChapters(projectForm.source_novel_id),
    loadNovelBrief(projectForm.source_novel_id),
    loadPackages(projectForm.source_novel_id),
  ]);
}
async function load() {
  detail.value = await request(`/projects/${route.params.id}`);
  fillProject();
  ensureBoard();
  await loadPackages(projectForm.source_novel_id);
}
async function saveProject() {
  try {
    await request(`/projects/${route.params.id}`, {
      method: 'put',
      data: {
        name: projectForm.name,
        source_novel_id: isScience.value ? null : (projectForm.source_novel_id || null),
        visual_style: projectForm.visual_style || '',
      },
    });
    await load();
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function pull() {
  try {
    const data = { novel_id: projectForm.source_novel_id, chapter_id: chapterId.value };
    if (packageVersion.value && packageDesk.value?.package_id) {
      data.package_id = packageDesk.value.package_id;
      data.version = packageVersion.value;
    }
    const updating = pullLabel.value === '更新到此版本';
    const result = updating
      ? await request(`/projects/${route.params.id}/rebase`, { method: 'post', data: { version: packageVersion.value, chapter_id: chapterId.value } })
      : await request(`/projects/${route.params.id}/imports/from-novel`, { method: 'post', data });
    await load();
    if (result?.unchanged) ElMessage.success(`这一章已经是故事包 v${result.package_version}`);
    else if (result?.preserved_shots) ElMessage.success(`已更新到 v${result.package_version}，${result.preserved_shots} 条已改过的台词或描述保持原样`);
    else if (result?.updated) ElMessage.success(`已更新到 v${result.package_version}`);
    else ElMessage.success(data.package_id ? '已按故事包版本拉取' : '已拉取章节');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function openPromote(row) {
  promoteShotId.value = row.id;
  promoteBefore.value = '';
  promoteAfter.value = row.dialogue || row.description || '';
  promoteVisible.value = true;
}
async function submitPromote() {
  try {
    await request(`/shots/${promoteShotId.value}/promote`, {
      method: 'post',
      data: { before: promoteBefore.value, after: promoteAfter.value },
    });
    promoteVisible.value = false;
    ElMessage.success('已提交到叙事工作台，等待作者应用');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function saveImport() {
  if (!body.value.trim()) {
    ElMessage.warning('请填写正文');
    return;
  }
  await request(`/projects/${route.params.id}/imports`, {
    method: 'post',
    data: {
      chapter_title: chapterTitle.value,
      body: body.value,
      source_novel_id: projectForm.source_novel_id || null,
    },
  });
  body.value = '';
  await load();
}
async function removeSnapshot(item) {
  try {
    await ElMessageBox.confirm(
      '删除后章节目录不再显示这条快照。已经生成的分镜会留在分镜页，并标成已删除。',
      '删除快照',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await request(`/projects/${route.params.id}/imports/${item.id}`, { method: 'delete' });
    selectedImportKey.value = String(item.id);
    await load();
    ElMessage.success('已删除快照，分镜仍保留');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function setPrompt(row, key, value) {
  if (!row.prompt) row.prompt = { positive_zh: '', negative_zh: '' };
  row.prompt[key] = value;
}
async function saveShot(row) {
  await request(`/shots/${row.id}`, {
    method: 'put',
    data: {
      description: row.description,
      shot_size: row.shot_size,
      camera_move: row.camera_move,
      positive_zh: row.prompt?.positive_zh || '',
      negative_zh: row.prompt?.negative_zh || '',
    },
  });
}
async function draft(item) {
  draftingId.value = item.id;
  notice.value = '正在起草，这一步不出图';
  noticeType.value = 'info';
  try {
    await request(`/projects/${route.params.id}/imports/${item.id}/draft`, { method: 'post', timeout: 600000 });
    notice.value = '分镜已写入，可以再改';
    noticeType.value = 'success';
    selectedImportKey.value = String(item.id);
    await load();
    step.value = 3;
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  } finally {
    draftingId.value = null;
  }
}
async function addShot() {
  const current = selectedBoard.value;
  if (!current) return;
  await request(`/projects/${route.params.id}/shots`, {
    method: 'post',
    data: { ...shot, import_id: current.importId },
  });
  shot.description = '';
  shot.positive_zh = '';
  await load();
}
onMounted(async () => {
  const [catalog, metaRes] = await Promise.all([
    request('/novel-catalog').catch(() => []),
    request('/meta').catch(() => null),
  ]);
  novels.value = catalog || [];
  if (metaRes) {
    meta.visual_styles = metaRes.visual_styles || [];
    meta.shot_sizes = metaRes.shot_sizes || meta.shot_sizes;
    meta.camera_moves = metaRes.camera_moves || meta.camera_moves;
  }
  await load();
  await Promise.all([
    loadChapters(projectForm.source_novel_id),
    loadNovelBrief(projectForm.source_novel_id),
  ]);
});
</script>

<style scoped>
.cartoon-setting-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}
.cartoon-snap { margin-bottom: 12px; }
.cartoon-snap__actions { display: flex; gap: 8px; }
.cartoon-board { display: flex; gap: 16px; align-items: flex-start; width: 100%; min-width: 0; }
.cartoon-board__snaps { flex: 0 0 240px; display: flex; flex-direction: column; gap: 8px; }
.cartoon-board__label { margin: 0; color: #5c6b62; font-size: 13px; }
.cartoon-board__snap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid rgba(47, 138, 91, 0.25);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.cartoon-board__snap.is-active { border-color: #2f8a5b; background: #eef7f1; }
.cartoon-board__snap-title { flex: 1 1 100%; font-weight: 600; }
.cartoon-board__snap-count { color: #5c6b62; font-size: 12px; }
.cartoon-board__main { flex: 1; min-width: 0; overflow: hidden; }
.cartoon-board__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
@media (max-width: 900px) {
  .cartoon-setting-grid { grid-template-columns: 1fr; }
}
</style>
