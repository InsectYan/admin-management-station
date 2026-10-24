<template>
  <div v-if="detail" class="cartoon-overview">
    <header class="cartoon-overview__header">
      <div class="cartoon-overview__bar">
        <el-button link type="primary" @click="router.push('/projects')">← 返回列表</el-button>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item><a href="#" @click.prevent="router.push('/projects')">AI 视频</a></el-breadcrumb-item>
          <el-breadcrumb-item>详情</el-breadcrumb-item>
          <el-breadcrumb-item>{{ tabTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="cartoon-overview__actions">
          <el-button @click="openWorkbench('compose')">剪辑成片</el-button>
          <el-button type="primary" @click="openWorkbench('input')">进入制作</el-button>
        </div>
      </div>
      <div class="cartoon-overview__hero">
        <div class="cartoon-overview__mark">{{ mark }}</div>
        <div>
          <h1>{{ detail.project.name }}</h1>
          <div class="cartoon-overview__tags">
            <el-tag v-if="styleLabel" size="small">{{ styleLabel }}</el-tag>
            <el-tag v-if="novelBrief?.title" size="small" effect="plain">{{ novelBrief.title }}</el-tag>
            <el-tag size="small" effect="light">{{ detail.project.status || 'draft' }}</el-tag>
          </div>
        </div>
      </div>
    </header>

    <div class="cartoon-overview__body">
      <aside class="cartoon-overview__nav">
        <button
          v-for="item in tabs"
          :key="item.step"
          type="button"
          class="cartoon-overview__tab"
          :class="{ 'is-active': tab === item.step }"
          @click="tab = item.step"
        >
          <span>{{ item.step }}</span>
          {{ item.title }}
        </button>
      </aside>
      <div class="cartoon-overview__pane">
        <section v-show="tab === 1" class="cartoon-module">
          <h3 class="cartoon-module__title">项目设定</h3>
          <el-alert v-if="gaps.length" class="cartoon-module" type="warning" :closable="false" show-icon :title="`待补：${gaps.join('、')}`" />
          <dl class="cartoon-overview__facts">
            <div><dt>项目名称</dt><dd>{{ detail.project.name }}</dd></div>
            <div><dt>画面风格</dt><dd>{{ styleLabel || '未选择' }}</dd></div>
            <div v-if="isLocal"><dt>文案</dt><dd>本地文案</dd></div>
            <div v-else><dt>来源小说</dt><dd>{{ novelBrief?.title || '未绑定' }}</dd></div>
            <div><dt>章节快照</dt><dd>{{ liveImports.length }}</dd></div>
            <div><dt>分镜</dt><dd>{{ detail.shots.length }}</dd></div>
            <div><dt>生成记录</dt><dd>{{ detail.tasks.length }}</dd></div>
          </dl>
          <section class="cartoon-module">
            <h3 class="cartoon-module__title">壳上登记的成员</h3>
            <p class="cartoon-module__hint">名单来自壳，这里只展示，不在视频项目里另行邀请。</p>
            <el-alert v-if="shellNote" type="info" :title="shellNote" show-icon :closable="false" />
            <el-empty v-else-if="!shellMembers.length" description="壳上还没有登记这个项目的成员" />
            <el-table v-else :data="shellMembers" size="small">
              <el-table-column prop="username" label="账号" />
              <el-table-column prop="role_label" label="角色" width="120" />
            </el-table>
          </section>
          <NovelBriefPanel v-if="!isLocal" :novel="novelBrief" :loading="novelLoading" />
          <TypePanel v-if="showPanel" :project-id="projectId" />
          <ExportSpecs :project-id="projectId" />
          <ReviewBox :project-id="projectId" />
        </section>

        <section v-if="tab === 2 && isLocal" class="cartoon-module">
          <h3 class="cartoon-module__title">本地文案</h3>
          <CopyBlocks :project-id="projectId" />
        </section>

        <section v-show="tab === 2 && !isLocal" class="cartoon-module">
          <h3 class="cartoon-module__title">章节快照</h3>
          <el-empty v-if="!liveImports.length" description="还没有章节快照" />
          <article v-for="item in liveImports" :key="item.id" class="cartoon-overview__snap">
            <strong>{{ item.chapter_title || '未命名章节' }}</strong>
            <p>{{ excerpt(item.body) }}</p>
          </article>
        </section>

        <section v-show="tab === 3" class="cartoon-module">
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
                <span class="cartoon-board__snap-count">{{ item.count }} 镜</span>
              </button>
            </aside>
            <div class="cartoon-board__main">
              <el-empty v-if="!selectedBoard" description="先选择一条章节快照" />
              <el-table v-else :data="boardShots">
                <el-table-column prop="sort_order" label="#" width="60" />
                <el-table-column prop="shot_size" label="景别" width="90" />
                <el-table-column prop="camera_move" label="运镜" width="90" />
                <el-table-column prop="description" label="描述" min-width="180" />
                <el-table-column label="正向提示词" min-width="180">
                  <template #default="{ row }">{{ row.prompt?.positive_zh || '—' }}</template>
                </el-table-column>
                <el-table-column label="操作" width="168" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="primary" :disabled="!canMake()" @click.stop="openGenerate(row)">生成产物</el-button>
                    <el-button link type="primary" @click.stop="openOutputs(row)">查看产物</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </section>

        <section v-show="tab === 4" class="cartoon-module">
          <h3 class="cartoon-module__title">批量选题</h3>
          <BatchPanel :project-id="projectId" :science="isLocal" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NovelBriefPanel from '../components/NovelBriefPanel.vue';
import CopyBlocks from '../components/CopyBlocks.vue';
import BatchPanel from '../components/BatchPanel.vue';
import TypePanel from '../components/TypePanel.vue';
import ExportSpecs from '../components/ExportSpecs.vue';
import ReviewBox from '../components/ReviewBox.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { hasPanel, isLocalType } from '../lib/contentTypes.js';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id);
const isLocal = computed(() => isLocalType(detail.value?.project?.content_type));
const showPanel = computed(() => hasPanel(detail.value?.project?.content_type));
const tabs = computed(() => [
  { step: 1, title: '概览' },
  { step: 2, title: isLocal.value ? '本地文案' : '章节快照' },
  { step: 3, title: '分镜' },
  { step: 4, title: '批量' },
]);
const tab = ref(Number(route.query.tab) || 1);
const detail = ref(null);
const styles = ref([]);
const novelBrief = ref(null);
const novelLoading = ref(false);
const shellMembers = ref([]);
const shellNote = ref('');
const selectedImportKey = ref('');

const tabTitle = computed(() => tabs.value.find(item => item.step === tab.value)?.title || '概览');
const mark = computed(() => (detail.value?.project?.name || '漫').trim().slice(0, 1));
const styleLabel = computed(() => styles.value.find(item => item.value === detail.value?.project?.visual_style)?.label || '');
const liveImports = computed(() => (detail.value?.imports || []).filter(item => !item.deleted_at));
const gaps = computed(() => detail.value?.gaps || []);
const boardItems = computed(() => {
  const imports = detail.value?.imports || [];
  const shots = detail.value?.shots || [];
  const items = imports.map(item => ({
    key: String(item.id),
    importId: item.id,
    title: item.chapter_title || '未命名章节',
    deleted: Boolean(item.deleted_at),
    count: shots.filter(shot => String(shot.import_id) === String(item.id)).length,
  }));
  const orphans = shots.filter(shot => shot.import_id == null);
  if (orphans.length) {
    items.push({ key: 'orphan', importId: null, title: '未关联快照', deleted: false, count: orphans.length });
  }
  return items;
});
const selectedBoard = computed(() => boardItems.value.find(item => item.key === selectedImportKey.value) || null);
const boardShots = computed(() => {
  const current = selectedBoard.value;
  if (!current) return [];
  const shots = detail.value?.shots || [];
  if (current.importId == null) return shots.filter(shot => shot.import_id == null);
  return shots.filter(shot => String(shot.import_id) === String(current.importId));
});

function excerpt(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > 180 ? `${value.slice(0, 180)}…` : value;
}
function ensureBoard() {
  const items = boardItems.value;
  if (!items.length) {
    selectedImportKey.value = '';
    return;
  }
  if (!items.some(item => item.key === selectedImportKey.value)) {
    selectedImportKey.value = (items.find(item => !item.deleted) || items[0]).key;
  }
}
function openWorkbench(node, shot) {
  const taskId = detail.value?.episodes?.[0]?.id;
  const query = { node };
  if (shot) query.shot = String(shot);
  if (!taskId) {
    router.push({ path: `/projects/${projectId.value}/work`, query });
    return;
  }
  router.push({ path: `/projects/${projectId.value}/tasks/${taskId}`, query });
}
function openGenerate(row) {
  openWorkbench('generate', row.id);
}
function openOutputs(row) {
  openWorkbench('preview', row.id);
}
async function loadNovel(novelId) {
  novelBrief.value = null;
  if (!novelId) return;
  novelLoading.value = true;
  try {
    novelBrief.value = await request(`/novel-catalog/${novelId}`);
  } finally {
    novelLoading.value = false;
  }
}
async function loadShell() {
  try {
    const data = await request(`/projects/${projectId.value}/shell-members`);
    shellMembers.value = data.rows || [];
    shellNote.value = data.note || '';
  } catch (err) {
    shellMembers.value = [];
    shellNote.value = err.message || '壳上的成员名单暂时读不到';
  }
}
async function load() {
  detail.value = await request(`/projects/${projectId.value}`);
  ensureBoard();
  await loadNovel(detail.value?.project?.source_novel_id);
  await loadShell();
}
watch(tab, value => {
  router.replace({ query: { ...route.query, tab: String(value) } });
});
onMounted(async () => {
  const meta = await request('/meta').catch(() => ({ visual_styles: [] }));
  styles.value = meta.visual_styles || [];
  await load();
});
</script>

<style scoped>
.cartoon-overview { display: flex; flex-direction: column; min-height: 0; padding: 16px 20px 24px; gap: 12px; }
.cartoon-overview__bar, .cartoon-overview__actions, .cartoon-overview__tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cartoon-overview__bar { justify-content: space-between; }
.cartoon-overview__hero { display: flex; gap: 16px; align-items: center; margin-top: 12px; }
.cartoon-overview__hero h1 { margin: 0 0 8px; font-size: 22px; color: #1f3d2c; }
.cartoon-overview__mark {
  width: 64px; height: 84px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: #2f8a5b; color: #fff; font-size: 28px; font-weight: 700;
}
.cartoon-overview__body { display: flex; gap: 16px; align-items: flex-start; min-height: 0; }
.cartoon-overview__nav { flex: 0 0 180px; display: flex; flex-direction: column; gap: 8px; }
.cartoon-overview__tab {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(47, 138, 91, 0.2);
  background: rgba(255, 255, 255, 0.7); cursor: pointer; text-align: left; color: #2c4336;
}
.cartoon-overview__tab.is-active { border-color: #2f8a5b; background: #fff; font-weight: 600; }
.cartoon-overview__pane { flex: 1; min-width: 0; }
.cartoon-overview__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
.cartoon-overview__facts dt { color: #5c6b62; font-size: 12px; }
.cartoon-overview__facts dd { margin: 4px 0 0; }
.cartoon-overview__snap { margin-bottom: 12px; }
.cartoon-overview__snap p { margin: 6px 0 0; color: #5c6b62; }
.cartoon-board { display: flex; gap: 16px; align-items: flex-start; width: 100%; min-width: 0; }
.cartoon-board__snaps { flex: 0 0 240px; display: flex; flex-direction: column; gap: 8px; }
.cartoon-board__label { margin: 0; color: #5c6b62; font-size: 13px; }
.cartoon-board__snap {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%;
  padding: 10px 12px; text-align: left; border: 1px solid rgba(47, 138, 91, 0.25);
  border-radius: 8px; background: #fff; cursor: pointer;
}
.cartoon-board__snap.is-active { border-color: #2f8a5b; background: #eef7f1; }
.cartoon-board__snap-title { flex: 1 1 100%; font-weight: 600; }
.cartoon-board__snap-count { color: #5c6b62; font-size: 12px; }
.cartoon-board__main { flex: 1; min-width: 0; overflow: hidden; }
@media (max-width: 900px) {
  .cartoon-overview__body, .cartoon-board { flex-direction: column; }
  .cartoon-overview__nav, .cartoon-board__snaps { flex-basis: auto; width: 100%; }
  .cartoon-overview__facts { grid-template-columns: 1fr; }
}
</style>
