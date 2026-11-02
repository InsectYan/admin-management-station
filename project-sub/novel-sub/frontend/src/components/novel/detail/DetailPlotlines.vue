<template>
  <section class="novel-plotlines">
    <header>
      <h3>剧情线</h3>
      <p>主线、支线、伏笔和情感线先记在这里。出现章节可以先不填，生成章节目录时会参考这些线的节奏。</p>
    </header>
    <h4>时间线</h4>
    <p>按章节顺序排列这些事件。有年份就记在事件上，不另排一套时间坐标。</p>
    <p v-if="worldYears.length">世界观年份：{{ worldYears.map(item => item.year).filter(Boolean).join('、') || '未标年份' }}</p>
    <el-empty v-if="!timeline.length" description="还没有可排列的事件" />
    <el-table v-else :data="timeline" size="small">
      <el-table-column label="章节" min-width="140">
        <template #default="{ row }">{{ row.chapter_title || row.chapter_id }}</template>
      </el-table-column>
      <el-table-column prop="plotline_name" label="剧情线" width="140" />
      <el-table-column prop="summary" label="摘要" min-width="160" />
      <el-table-column label="年份" width="220">
        <template #default="{ row }">
          <el-input v-model="row.year" placeholder="可空" style="width: 120px" />
          <el-button link type="primary" @click="saveYear(row)">记下</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="novel-bulk-bar">
      <el-button type="primary" plain size="small" @click="openCreate">添加</el-button>
      <el-button type="danger" plain size="small" :disabled="!lines.length" @click="removeChecked">一键删除</el-button>
    </div>
    <el-table :data="lines" row-key="id" size="small" empty-text="还没有剧情线" @selection-change="picked = $event">
      <el-table-column type="selection" width="48" />
      <el-table-column label="名称" prop="name" min-width="140" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ kindLabel(row.kind) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">{{ statusLabel(row.status) }}</template>
      </el-table-column>
      <el-table-column label="概要" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.summary || '—' }}</template>
      </el-table-column>
      <el-table-column label="章节" min-width="140">
        <template #default="{ row }">{{ chapterText(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer
      v-model="drawerOpen"
      class="novel-plotline-drawer"
      :title="drawerTitle"
      direction="rtl"
      size="480px"
      append-to-body
    >
      <dl v-if="mode === 'detail' && viewing" class="novel-detail-fields novel-plotline-detail">
        <div class="novel-detail-fields__row">
          <dt>名称</dt>
          <dd class="is-strong">{{ viewing.name }}</dd>
        </div>
        <div class="novel-detail-fields__row novel-detail-fields__row--split">
          <div>
            <dt>类型</dt>
            <dd><el-tag size="small">{{ kindLabel(viewing.kind) }}</el-tag></dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd><el-tag size="small" effect="plain">{{ statusLabel(viewing.status) }}</el-tag></dd>
          </div>
        </div>
        <div class="novel-detail-fields__row">
          <dt>概要</dt>
          <dd><NovelMarkdown :source="viewing.summary" empty-text="未填写" /></dd>
        </div>
        <div class="novel-detail-fields__row">
          <dt>出现章节</dt>
          <dd>{{ chapterText(viewing) }}</dd>
        </div>
        <div v-if="viewing.kind === 'foreshadow'" class="novel-detail-fields__row novel-detail-fields__row--split">
          <div>
            <dt>埋设章节</dt>
            <dd>{{ chapterTitle(viewing.plant_chapter_id) }}</dd>
          </div>
          <div>
            <dt>计划回收</dt>
            <dd>{{ chapterTitle(viewing.payoff_chapter_id) }}</dd>
          </div>
        </div>
      </dl>
      <el-form v-else label-position="top" class="novel-entry-form" @submit.prevent>
        <div class="novel-entry-grid">
          <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item class="is-wide" label="概要">
            <el-input v-model="form.summary" type="textarea" :rows="3" placeholder="这条线要推进什么" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="form.kind" style="width: 100%">
              <el-option v-for="item in kinds" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item class="is-wide" label="出现章节">
            <el-select v-model="form.chapterIds" multiple clearable placeholder="可留空；已有章节时再选" style="width: 100%">
              <el-option v-for="chapter in chapters" :key="chapter.chapter_id" :label="chapter.title" :value="chapter.chapter_id" />
            </el-select>
            <p class="novel-plotlines__optional">可留空。不填也能保存，章节目录生成时会用这条线的概要来排节奏。</p>
          </el-form-item>
          <template v-if="form.kind === 'foreshadow'">
            <el-form-item label="埋设章节">
              <el-select v-model="form.plant_chapter_id" clearable placeholder="可留空" style="width: 100%">
                <el-option v-for="chapter in chapters" :key="`p-${chapter.chapter_id}`" :label="chapter.title" :value="chapter.chapter_id" />
              </el-select>
            </el-form-item>
            <el-form-item label="计划回收">
              <el-select v-model="form.payoff_chapter_id" clearable placeholder="可留空" style="width: 100%">
                <el-option v-for="chapter in chapters" :key="`o-${chapter.chapter_id}`" :label="chapter.title" :value="chapter.chapter_id" />
              </el-select>
            </el-form-item>
          </template>
        </div>
      </el-form>
      <template v-if="mode === 'form'" #footer>
        <div class="novel-plotline-drawer__footer">
          <el-button @click="drawerOpen = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import { confirmBulkDelete } from '../../../utils/tableBulkDelete.js';
import {
  createPlotline,
  deletePlotline,
  fetchChapterMeta,
  fetchPlotlines,
  fetchTimeline,
  saveTimelineYear,
  updatePlotline,
} from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [Number, String], required: true },
});

const kinds = [
  { value: 'main', label: '主线' },
  { value: 'side', label: '支线' },
  { value: 'foreshadow', label: '伏笔' },
  { value: 'emotion', label: '情感' },
];
const statuses = [
  { value: 'open', label: '未开始' },
  { value: 'active', label: '进行中' },
  { value: 'resolved', label: '已回收' },
  { value: 'dropped', label: '已废弃' },
];

const lines = ref([]);
const picked = ref([]);
const chapters = ref([]);
const timeline = ref([]);
const worldYears = ref([]);
const saving = ref(false);
const drawerOpen = ref(false);
const mode = ref('form');
const viewing = ref(null);
const form = reactive(emptyForm());

function emptyForm() {
  return {
    id: null,
    name: '',
    summary: '',
    kind: 'main',
    status: 'open',
    chapterIds: [],
    plant_chapter_id: '',
    payoff_chapter_id: '',
    summaries: {},
    years: {},
  };
}

function kindLabel(value) {
  return kinds.find(item => item.value === value)?.label || value;
}

function statusLabel(value) {
  return statuses.find(item => item.value === value)?.label || value;
}

function chapterTitle(chapterId) {
  if (!chapterId) return '未填写';
  return chapters.value.find(item => item.chapter_id === chapterId)?.title || chapterId;
}

function chapterText(row) {
  const titles = (row.events || []).map(event => chapterTitle(event.chapter_id));
  if (row.kind === 'foreshadow' && !row.payoff_chapter_id) titles.push('未设回收');
  return titles.filter(title => title && title !== '未填写').join('、') || '未绑定';
}

function reset() {
  Object.assign(form, emptyForm());
}

const drawerTitle = computed(() => {
  if (mode.value === 'detail') return '剧情详情';
  return form.id ? '编辑剧情' : '添加剧情';
});

function openCreate() {
  reset();
  mode.value = 'form';
  drawerOpen.value = true;
}

function openDetail(row) {
  viewing.value = row;
  mode.value = 'detail';
  drawerOpen.value = true;
}

function openEdit(row) {
  edit(row);
  mode.value = 'form';
  drawerOpen.value = true;
}

function knownKind(value) {
  return kinds.some(item => item.value === value) ? value : 'main';
}

function knownStatus(value) {
  return statuses.some(item => item.value === value) ? value : 'open';
}

function edit(row) {
  form.id = row.id;
  form.name = row.name;
  form.summary = row.summary || '';
  form.kind = row.kind;
  form.status = row.status;
  form.chapterIds = (row.events || []).map(event => event.chapter_id);
  form.plant_chapter_id = row.plant_chapter_id || '';
  form.payoff_chapter_id = row.payoff_chapter_id || '';
  form.summaries = Object.fromEntries((row.events || []).map(event => [ event.chapter_id, event.summary || '' ]));
  form.years = Object.fromEntries((row.events || []).map(event => [ event.chapter_id, event.year || '' ]));
}

async function load() {
  const [list, meta, view] = await Promise.all([
    fetchPlotlines(props.novelId),
    fetchChapterMeta(props.novelId),
    fetchTimeline(props.novelId),
  ]);
  lines.value = list || [];
  chapters.value = meta || [];
  timeline.value = view?.events || [];
  worldYears.value = view?.world_years || [];
}

function formPayload() {
  return {
    name: form.name.trim(),
    summary: form.summary.trim(),
    kind: knownKind(form.kind),
    status: knownStatus(form.status),
    plant_chapter_id: form.kind === 'foreshadow' ? form.plant_chapter_id : '',
    payoff_chapter_id: form.kind === 'foreshadow' ? form.payoff_chapter_id : '',
    events: form.chapterIds.map(chapterId => ({
      chapter_id: chapterId,
      summary: form.summaries[chapterId] || '',
      year: form.years[chapterId] || '',
    })),
  };
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('先写名称');
    return false;
  }
  const creating = !form.id;
  saving.value = true;
  try {
    if (form.id) await updatePlotline(props.novelId, form.id, formPayload());
    else await createPlotline(props.novelId, formPayload());
    drawerOpen.value = false;
    await load();
    ElMessage.success(creating ? '已添加剧情线' : '剧情线已保存');
    return true;
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveYear(row) {
  try {
    const view = await saveTimelineYear(props.novelId, {
      plotline_id: row.plotline_id,
      chapter_id: row.chapter_id,
      year: row.year,
    });
    timeline.value = view?.events || [];
    worldYears.value = view?.world_years || [];
    ElMessage.success('年份已记下');
  } catch (err) {
    ElMessage.error(err.message || '没有记下年份');
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`删除剧情线「${row.name}」？章节正文保持不变。`, '删除剧情线', { type: 'warning' });
  } catch {
    return false;
  }
  await deletePlotline(props.novelId, row.id);
  if (form.id === row.id || viewing.value?.id === row.id) drawerOpen.value = false;
  await load();
  return true;
}

async function removeChecked() {
  const selected = picked.value;
  const ok = await confirmBulkDelete({
    selectedCount: selected.length,
    totalCount: selected.length || lines.value.length,
  });
  if (!ok) return;
  const targets = selected.length ? selected : [...lines.value];
  try {
    for (const row of targets) {
      await deletePlotline(props.novelId, row.id);
      if (form.id === row.id) drawerOpen.value = false;
    }
    picked.value = [];
    ElMessage.success(selected.length ? '已删除勾选剧情线' : '已删除全部剧情线');
    await load();
  } catch (err) {
    ElMessage.error(err.message || '删除失败');
    await load();
  }
}

function hasDraft() {
  return drawerOpen.value && mode.value === 'form' && Boolean(form.name.trim());
}

async function applyFromPatch(patch) {
  const list = Array.isArray(patch?.plotlines) ? patch.plotlines.filter(row => String(row?.name || '').trim()) : [];
  if (!list.length) {
    ElMessage.info('这一轮没有可填入的剧情线');
    return;
  }
  if (!props.novelId) {
    ElMessage.warning('请先保存基础信息');
    return;
  }
  const existing = new Map(lines.value.map(row => [ row.name, row ]));
  try {
    for (const item of list) {
      const name = String(item.name).trim();
      const payload = {
        name,
        summary: String(item.summary || '').trim(),
        kind: knownKind(item.kind),
        status: knownStatus(item.status),
        events: [],
      };
      const hit = existing.get(name);
      if (hit) {
        await updatePlotline(props.novelId, hit.id, {
          ...payload,
          plant_chapter_id: hit.plant_chapter_id || '',
          payoff_chapter_id: hit.payoff_chapter_id || '',
          events: hit.events || [],
        });
      } else {
        const created = await createPlotline(props.novelId, payload);
        if (created?.id) existing.set(name, created);
      }
    }
    await load();
    ElMessage.success(`已写入 ${list.length} 条剧情线`);
  } catch (err) {
    ElMessage.error(err.message || '写入剧情线失败');
    await load().catch(() => {});
  }
}

defineExpose({ applyFromPatch, hasDraft, save });

onMounted(() => {
  load().catch(err => ElMessage.error(err.message || '剧情线加载失败'));
});
</script>

<style scoped>
.novel-plotlines {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.novel-plotlines header p,
.novel-plotlines__optional {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.novel-bulk-bar,
.novel-plotline-drawer__footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.novel-bulk-bar {
  justify-content: flex-end;
}
.novel-plotline-drawer__footer {
  width: 100%;
  justify-content: flex-end;
}
.novel-plotlines :deep(.el-table__cell .el-button + .el-button) {
  margin-left: 4px;
}
.novel-plotline-detail {
  --novel-color-text: #2c4336;
  --novel-color-text-muted: #8a968e;
  --novel-color-deep: #2a3a30;
  color: var(--novel-color-text);
}
.novel-detail-fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.novel-detail-fields__row dt {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--novel-color-text-muted, #8a968e);
}
.novel-detail-fields__row dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}
.novel-detail-fields__row--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.novel-plotline-detail .is-strong {
  font-size: 18px;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30);
}
</style>
