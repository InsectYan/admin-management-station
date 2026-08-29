<template>
  <PageShell title="小说中心" :table-layout="viewMode === 'table'">
    <template #extra>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>首页</el-breadcrumb-item>
        <el-breadcrumb-item>小说中心</el-breadcrumb-item>
        <el-breadcrumb-item>列表页</el-breadcrumb-item>
      </el-breadcrumb>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建小说</el-button>
      <el-button :icon="MagicStick" @click="openAiBook">AI 开书</el-button>
    </template>

    <div class="novel-list-toolbar">
      <el-segmented v-model="viewMode" :options="viewOptions" />
    </div>

    <div class="novel-filter-bar">
      <el-input
        v-model="filters.title"
        placeholder="小说名称"
        clearable
        style="width: 220px"
        @keyup.enter="applyFilters"
        @clear="applyFilters"
      />
      <el-select
        v-model="filters.genre"
        placeholder="小说类型"
        clearable
        filterable
        style="width: 140px"
        @change="applyFilters"
      >
        <el-option v-for="g in enums.genres" :key="g.id" :label="g.name" :value="g.name" />
      </el-select>
      <el-select
        v-model="filters.novel_type"
        placeholder="篇幅"
        clearable
        style="width: 120px"
        @change="applyFilters"
      >
        <el-option v-for="t in enums.lengths" :key="t.id" :label="t.name" :value="t.name" />
      </el-select>
      <el-select
        v-model="filters.progress_status"
        placeholder="进度"
        clearable
        style="width: 120px"
        @change="applyFilters"
      >
        <el-option v-for="p in PROGRESS_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
      <el-button type="primary" @click="applyFilters">筛选</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="novel-list-error"
    >
      <el-button link type="primary" @click="reload">重试</el-button>
    </el-alert>

    <!-- 看板视图 -->
    <template v-else-if="viewMode === 'board'">
      <div v-loading="loading && novels.length === 0" class="novel-board">
        <el-empty
          v-if="!loading && novels.length === 0"
          description="暂无符合条件的小说，去新建一篇吧"
        >
          <el-button type="primary" @click="openCreate">新建小说</el-button>
          <el-button @click="openAiBook">AI 开书</el-button>
        </el-empty>

        <div v-else class="novel-board-grid">
          <div
            v-for="item in novels"
            :key="item.id"
            class="novel-card"
            @click="openDetail(item)"
          >
            <div class="novel-card__cover">
              <el-image
                v-if="item.cover_url"
                :src="item.cover_url"
                fit="cover"
                class="novel-card__cover-img"
              >
                <template #error>
                  <div class="novel-card__cover-fallback">{{ coverFallback(item.title) }}</div>
                </template>
              </el-image>
              <div v-else class="novel-card__cover-fallback">{{ coverFallback(item.title) }}</div>
            </div>
            <div class="novel-card__body">
              <el-tooltip :content="item.title" placement="top" :disabled="item.title.length <= 20">
                <h4 class="novel-card__title">{{ item.title }}</h4>
              </el-tooltip>
              <div class="novel-card__tags">
                <el-tag v-if="item.genre" size="small" :type="GENRE_TAG_TYPE[item.genre] || 'info'">
                  {{ formatGenreLabel(item) }}
                </el-tag>
                <el-tag v-if="item.novel_type" size="small" effect="plain">{{ item.novel_type }}</el-tag>
              </div>
              <div class="novel-card__progress">
                <el-tag
                  size="small"
                  :type="item.progress_status === 'completed' ? 'success' : 'warning'"
                  effect="light"
                >
                  {{ progressLabel(item.progress_status) }}
                </el-tag>
                <el-progress
                  v-if="item.progress_status === 'ongoing'"
                  :percentage="item.progress_percent || 0"
                  :stroke-width="6"
                  :show-text="false"
                  style="flex: 1; margin-left: 8px"
                />
              </div>
              <el-tooltip v-if="item.summary" :content="item.summary" placement="top">
                <p class="novel-card__summary">{{ item.summary }}</p>
              </el-tooltip>
            </div>
            <div class="novel-card__actions">
              <el-button size="small" type="primary" plain @click.stop="openDetail(item)">查看详情</el-button>
              <el-button size="small" plain @click.stop="openCreateWizard(item)">继续创作</el-button>
            </div>
          </div>
        </div>

        <div v-if="novels.length > 0" class="novel-board-footer">
          <el-button
            v-if="hasMore"
            :loading="loading"
            @click="loadMoreBoard"
          >
            加载更多
          </el-button>
          <span v-else class="novel-board-footer__hint">已加载全部 {{ total }} 条</span>
        </div>
      </div>
    </template>

    <!-- 表格视图 -->
    <template v-else>
      <div v-if="selectedRows.length" class="novel-action-bar">
        <span class="novel-action-bar__hint">已选 {{ selectedRows.length }} 项</span>
        <el-popconfirm title="确定批量删除选中小说？" @confirm="handleBatchDelete">
          <template #reference>
            <el-button type="danger" plain :loading="batchDeleting">批量删除</el-button>
          </template>
        </el-popconfirm>
        <el-dropdown trigger="click" @command="toggleColumn">
          <el-button>自定义列</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="col in TABLE_COLUMNS"
                :key="col.key"
                :command="col.key"
              >
                <el-checkbox :model-value="visibleColumns.includes(col.key)" @click.stop>
                  {{ col.label }}
                </el-checkbox>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <DataTablePanel
        :page="page"
        :page-size="pageSize"
        :total="total"
        :loading="loading"
        @update:page="setPage"
        @update:page-size="setPageSize"
        @change="loadNovels"
      >
        <template #default="{ bodyHeight }">
          <el-table
            v-loading="loading"
            :data="novels"
            :height="bodyHeight ?? undefined"
            row-key="id"
            stripe
            border
            style="width: 100%"
            empty-text="暂无小说，点击右上角新建"
            @selection-change="selectedRows = $event"
            @sort-change="handleSortChange"
          >
            <el-table-column type="selection" width="48" fixed="left" />
            <el-table-column
              v-if="visibleColumns.includes('title')"
              prop="title"
              label="小说名称"
              min-width="200"
              sortable="custom"
              fixed="left"
            >
              <template #default="{ row }">
                <div class="novel-table-title">
                  <div class="novel-table-title__cover">
                    <el-image v-if="row.cover_url" :src="row.cover_url" fit="cover">
                      <template #error>
                        <span>{{ coverFallback(row.title) }}</span>
                      </template>
                    </el-image>
                    <span v-else>{{ coverFallback(row.title) }}</span>
                  </div>
                  <el-tooltip :content="row.title" placement="top">
                    <span class="novel-table-title__text">{{ row.title }}</span>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('genre')"
              prop="genre"
              label="小说类型"
              width="140"
            >
              <template #default="{ row }">
                <el-tag v-if="row.genre" size="small" :type="GENRE_TAG_TYPE[row.genre] || 'info'">
                  {{ formatGenreLabel(row) }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('novel_type')"
              prop="novel_type"
              label="篇幅"
              width="90"
            />
            <el-table-column
              v-if="visibleColumns.includes('progress_status')"
              prop="progress_status"
              label="进度"
              width="140"
            >
              <template #default="{ row }">
                <div class="novel-table-progress">
                  <el-tag
                    size="small"
                    :type="row.progress_status === 'completed' ? 'success' : 'warning'"
                    effect="light"
                  >
                    {{ progressLabel(row.progress_status) }}
                  </el-tag>
                  <el-progress
                    v-if="row.progress_status === 'ongoing'"
                    :percentage="row.progress_percent || 0"
                    :stroke-width="6"
                    style="width: 60px"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('updated_at')"
              prop="updated_at"
              label="更新时间"
              width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('created_at')"
              prop="created_at"
              label="创建时间"
              width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row)">详情</el-button>
                <el-button link type="primary" @click="openCreateWizard(row)">继续创作</el-button>
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-popconfirm title="确定删除该小说？" @confirm="handleDelete(row.id)">
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </DataTablePanel>
    </template>

    <NovelEditDialog
      :visible="editVisible"
      :novel="editNovel"
      :saving="saving"
      @close="editVisible = false"
      @submit="handleSave"
    />
    <AiOpenBookDialog v-model="aiBookVisible" />
  </PageShell>
</template>

<script setup>
import {
  computed, onMounted, ref, watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus, MagicStick } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import NovelEditDialog from '../components/novel/NovelEditDialog.vue';
import AiOpenBookDialog from '../components/novel/ai/AiOpenBookDialog.vue';
import {
  batchDeleteNovels,
  deleteNovel,
  fetchNovels,
  updateNovel,
} from '../services/novelService.js';
import {
  GENRE_TAG_TYPE,
  PROGRESS_OPTIONS,
  TABLE_COLUMNS,
  coverFallback,
  formatGenreLabel,
  progressLabel,
} from '../utils/novelMeta.js';
import { formatDateTime } from '../utils/formatDateTime.js';
import { useNovelEnums } from '../composables/useNovelEnums.js';

const route = useRoute();
const router = useRouter();
const { enums, load: loadEnums } = useNovelEnums();

const viewOptions = [
  { label: '小说看板', value: 'board' },
  { label: '小说管理', value: 'table' },
];

const loading = ref(false);
const loadError = ref('');
const novels = ref([]);
const total = ref(0);
const selectedRows = ref([]);
const batchDeleting = ref(false);
const saving = ref(false);

const editVisible = ref(false);
const editNovel = ref(null);
const aiBookVisible = ref(false);

const visibleColumns = ref(
  TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
);

const filters = ref({
  title: '',
  genre: '',
  novel_type: '',
  progress_status: '',
});

const viewMode = computed({
  get: () => (route.query.view === 'table' ? 'table' : 'board'),
  set: (val) => {
    if (val === 'board') boardPage.value = 1;
    syncQuery({ view: val });
  },
});

const page = computed({
  get: () => Number(route.query.page) || 1,
  set: (val) => syncQuery({ page: val }),
});

const pageSize = computed({
  get: () => Number(route.query.pageSize) || 20,
  set: (val) => syncQuery({ pageSize: val, page: 1 }),
});

const sortField = computed(() => route.query.sortField || 'updated_at');
const sortOrder = computed(() => route.query.sortOrder || 'desc');

const boardPage = ref(1);
const boardPageSize = 12;
const hasMore = computed(() => novels.value.length < total.value);

function syncQuery(patch) {
  const next = { ...route.query, ...patch };
  Object.keys(next).forEach((key) => {
    if (next[key] === '' || next[key] == null) delete next[key];
  });
  router.replace({ query: next });
}

function readFiltersFromQuery() {
  filters.value = {
    title: route.query.title || '',
    genre: route.query.genre || '',
    novel_type: route.query.novel_type || '',
    progress_status: route.query.progress_status || '',
  };
}

function applyFilters() {
  boardPage.value = 1;
  syncQuery({
    title: filters.value.title || undefined,
    genre: filters.value.genre || undefined,
    novel_type: filters.value.novel_type || undefined,
    progress_status: filters.value.progress_status || undefined,
    page: 1,
  });
}

function resetFilters() {
  boardPage.value = 1;
  filters.value = {
    title: '', genre: '', novel_type: '', progress_status: '',
  };
  syncQuery({
    title: undefined,
    genre: undefined,
    novel_type: undefined,
    progress_status: undefined,
    page: 1,
  });
}

function setPage(val) {
  page.value = val;
}

function setPageSize(val) {
  pageSize.value = val;
}

function buildListParams(override = {}) {
  const isBoard = viewMode.value === 'board';
  return {
    ...filters.value,
    page: override.page ?? (isBoard ? boardPage.value : page.value),
    pageSize: override.pageSize ?? (isBoard ? boardPageSize : pageSize.value),
    sortField: sortField.value,
    sortOrder: sortOrder.value,
    ...override,
  };
}

async function loadNovels(append = false) {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchNovels(buildListParams());
    if (append && viewMode.value === 'board') {
      novels.value = [...novels.value, ...(data.list || [])];
    } else {
      novels.value = data.list || [];
    }
    total.value = data.total || 0;
  } catch (e) {
    loadError.value = e.message || '加载失败';
    if (!append) novels.value = [];
  } finally {
    loading.value = false;
  }
}

function reload() {
  loadNovels();
}

function loadMoreBoard() {
  if (!hasMore.value || loading.value) return;
  boardPage.value += 1;
  loadNovels(true);
}

function openDetail(row) {
  router.push({ name: 'novel-detail', params: { id: String(row.id) } });
}

function openCreate() {
  router.push({ name: 'novel-create' });
}

function openAiBook() {
  aiBookVisible.value = true;
}

function openCreateWizard(row) {
  router.push({
    name: 'novel-create',
    query: { id: String(row.id), step: '1' },
  });
}

function openEdit(row) {
  editNovel.value = { ...row };
  editVisible.value = true;
}

async function handleSave(payload) {
  if (!editNovel.value?.id) return;
  saving.value = true;
  try {
    await updateNovel(editNovel.value.id, payload);
    ElMessage.success('保存成功');
    editVisible.value = false;
    await loadNovels();
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id) {
  try {
    await deleteNovel(id);
    ElMessage.success('已删除');
    await loadNovels();
  } catch (e) {
    ElMessage.error(e.message || '删除失败');
  }
}

async function handleBatchDelete() {
  batchDeleting.value = true;
  try {
    await batchDeleteNovels(selectedRows.value.map((r) => r.id));
    ElMessage.success('批量删除成功');
    selectedRows.value = [];
    await loadNovels();
  } catch (e) {
    ElMessage.error(e.message || '批量删除失败');
  } finally {
    batchDeleting.value = false;
  }
}

function toggleColumn(key) {
  if (visibleColumns.value.includes(key)) {
    if (visibleColumns.value.length <= 1) return;
    visibleColumns.value = visibleColumns.value.filter((k) => k !== key);
  } else {
    visibleColumns.value = [...visibleColumns.value, key];
  }
}

function handleSortChange({ prop, order }) {
  if (!order) {
    syncQuery({ sortField: undefined, sortOrder: undefined });
    return;
  }
  syncQuery({
    sortField: prop,
    sortOrder: order === 'ascending' ? 'asc' : 'desc',
  });
}

watch(
  () => route.query,
  (query, prev) => {
    readFiltersFromQuery();
    const filterKeys = ['title', 'genre', 'novel_type', 'progress_status', 'view'];
    if (prev && filterKeys.some((k) => query[k] !== prev[k])) {
      boardPage.value = 1;
    }
    loadNovels(false);
  },
  { immediate: true },
);

onMounted(() => {
  loadEnums();
  readFiltersFromQuery();
});
</script>

<style scoped>
.novel-list-toolbar {
  margin-bottom: 16px;
}

.novel-list-error {
  margin-bottom: 16px;
}

.novel-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

@media (min-width: 1200px) {
  .novel-board-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.novel-card {
  position: relative;
  border: var(--novel-border-subtle);
  border-radius: var(--novel-radius-base);
  overflow: hidden;
  background: var(--novel-color-surface);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.novel-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--novel-shadow-soft);
}

.novel-card:hover .novel-card__actions {
  opacity: 1;
}

.novel-card__cover {
  aspect-ratio: 3 / 4;
  background: var(--novel-color-mist);
  overflow: hidden;
}

.novel-card__cover-img,
.novel-card__cover-fallback {
  width: 100%;
  height: 100%;
}

.novel-card__cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--novel-gradient-cover);
  color: var(--novel-color-primary);
  font-size: 48px;
  font-weight: 600;
}

.novel-card__body {
  padding: 12px;
}

.novel-card__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--novel-color-deep);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  min-height: 42px;
}

.novel-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.novel-card__progress {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.novel-card__summary {
  margin: 0;
  font-size: 13px;
  color: var(--novel-color-text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.novel-card__actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px;
  display: flex;
  justify-content: center;
  background: linear-gradient(transparent, rgba(243, 248, 244, 0.92));
  opacity: 0;
  transition: opacity 0.2s ease;
}

.novel-board-footer {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.novel-board-footer__hint {
  font-size: 13px;
  color: var(--novel-color-text-muted);
}

.novel-table-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.novel-table-title__cover {
  width: 32px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--novel-gradient-cover);
  color: var(--novel-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.novel-table-title__cover .el-image {
  width: 100%;
  height: 100%;
}

.novel-table-title__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-table-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
