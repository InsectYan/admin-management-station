<template>
  <section class="novel-plotlines">
    <header>
      <h3>剧情线</h3>
      <p>主线、支线、伏笔和情感线记在这里。绑到章节只改这条线，不改正文。</p>
    </header>
    <el-form inline @submit.prevent>
      <el-input v-model="form.name" placeholder="名称" style="width: 160px" />
      <el-select v-model="form.kind" style="width: 110px">
        <el-option v-for="item in kinds" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="form.status" style="width: 120px">
        <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="form.chapterIds" multiple collapse-tags placeholder="出现章节" style="width: 220px">
        <el-option v-for="chapter in chapters" :key="chapter.chapter_id" :label="chapter.title" :value="chapter.chapter_id" />
      </el-select>
      <template v-if="form.kind === 'foreshadow'">
        <el-select v-model="form.plant_chapter_id" clearable placeholder="埋设章节" style="width: 160px">
          <el-option v-for="chapter in chapters" :key="`p-${chapter.chapter_id}`" :label="chapter.title" :value="chapter.chapter_id" />
        </el-select>
        <el-select v-model="form.payoff_chapter_id" clearable placeholder="计划回收" style="width: 160px">
          <el-option v-for="chapter in chapters" :key="`o-${chapter.chapter_id}`" :label="chapter.title" :value="chapter.chapter_id" />
        </el-select>
      </template>
      <el-button type="primary" :loading="saving" @click="save">{{ form.id ? '保存' : '添加' }}</el-button>
      <el-button v-if="form.id" @click="reset">取消</el-button>
    </el-form>
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
    <el-empty v-if="!lines.length" description="还没有剧情线" />
    <el-table v-else :data="lines" size="small">
      <el-table-column label="名称" prop="name" width="140" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ kindLabel(row.kind) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">{{ statusLabel(row.status) }}</template>
      </el-table-column>
      <el-table-column label="章节">
        <template #default="{ row }">{{ chapterText(row) }}</template>
      </el-table-column>
      <el-table-column label="" width="140">
        <template #default="{ row }">
          <el-button link type="primary" @click="edit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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
const chapters = ref([]);
const timeline = ref([]);
const worldYears = ref([]);
const saving = ref(false);
const form = reactive(emptyForm());

function emptyForm() {
  return {
    id: null,
    name: '',
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

function chapterText(row) {
  const titles = (row.events || []).map(event => chapters.value.find(item => item.chapter_id === event.chapter_id)?.title || event.chapter_id);
  if (row.kind === 'foreshadow' && !row.payoff_chapter_id) titles.push('未设回收');
  return titles.filter(Boolean).join('、') || '未绑定';
}

function reset() {
  Object.assign(form, emptyForm());
}

function edit(row) {
  form.id = row.id;
  form.name = row.name;
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

async function save() {
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning('先写名称');
    return;
  }
  saving.value = true;
  const payload = {
    name,
    kind: form.kind,
    status: form.status,
    plant_chapter_id: form.kind === 'foreshadow' ? form.plant_chapter_id : '',
    payoff_chapter_id: form.kind === 'foreshadow' ? form.payoff_chapter_id : '',
    events: form.chapterIds.map(chapterId => ({
      chapter_id: chapterId,
      summary: form.summaries[chapterId] || '',
      year: form.years[chapterId] || '',
    })),
  };
  try {
    if (form.id) await updatePlotline(props.novelId, form.id, payload);
    else await createPlotline(props.novelId, payload);
    reset();
    await load();
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
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
    return;
  }
  await deletePlotline(props.novelId, row.id);
  if (form.id === row.id) reset();
  await load();
}

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
.novel-plotlines header p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
}
</style>
