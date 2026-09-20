<template>
  <PageShell title="项目信息" :table-layout="viewMode === 'table'">
    <template #extra>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>首页</el-breadcrumb-item>
        <el-breadcrumb-item>项目信息</el-breadcrumb-item>
        <el-breadcrumb-item>列表</el-breadcrumb-item>
      </el-breadcrumb>
      <el-button @click="handleExportTemplate">导出模板</el-button>
      <el-upload
        :show-file-list="false"
        accept=".json,application/json"
        :disabled="importDlg.running"
        :before-upload="handleImport"
      >
        <el-button :disabled="importDlg.running">导入 JSON</el-button>
      </el-upload>
      <el-button @click="goJobs">部署任务</el-button>
      <el-button type="primary" :icon="Plus" @click="goCreate">新建</el-button>
    </template>

    <div class="ops-list-toolbar">
      <el-segmented v-model="viewMode" :options="viewOptions" />
    </div>

    <div class="ops-filter-bar">
      <el-input
        v-model="filters.name"
        placeholder="项目名称"
        clearable
        style="width: 220px"
        @keyup.enter="applyFilters"
        @clear="applyFilters"
      />
      <el-select
        v-model="filters.project_type"
        placeholder="项目类型"
        clearable
        style="width: 140px"
        @change="applyFilters"
      >
        <el-option
          v-for="item in PROJECT_TYPE_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="filters.status"
        placeholder="状态"
        clearable
        style="width: 140px"
        @change="applyFilters"
      >
        <el-option
          v-for="item in PROJECT_STATUS_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
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
      class="ops-list-error"
    >
      <el-button link type="primary" @click="reload">重试</el-button>
    </el-alert>

    <template v-else-if="viewMode === 'board'">
      <div v-loading="loading && projects.length === 0" class="ops-board">
        <el-empty
          v-if="!loading && projects.length === 0"
          description="暂无项目。可先导出模板，梳理目录/路由/流程图后再导入。"
        >
          <el-button @click="handleExportTemplate">导出模板</el-button>
          <el-button type="primary" @click="goCreate">新建</el-button>
        </el-empty>
        <div v-else class="ops-board-grid">
          <div
            v-for="item in projects"
            :key="item.id"
            class="ops-card"
            @click="openDetail(item)"
          >
            <div class="ops-card__cover">
              <div class="ops-card__cover-fallback">{{ coverFallback(item.name) }}</div>
            </div>
            <div class="ops-card__body">
              <h4 class="ops-card__title">{{ item.name }}</h4>
              <div class="ops-card__tags">
                <el-tag size="small">{{ typeLabel(item.project_type) }}</el-tag>
                <el-tag size="small" :type="statusMeta(item.status).type" effect="light">
                  {{ statusMeta(item.status).label }}
                </el-tag>
              </div>
              <p class="ops-card__stats">
                目录 {{ countTreeNodes(item.directory_tree) }} ·
                路由 {{ countRoutes(item.routes) }} ·
                流程图节点 {{ countFlowNodes(item.flows) }}
              </p>
              <p class="ops-card__summary">{{ item.description || '暂无简介' }}</p>
              <p class="ops-card__time">更新于 {{ formatDateTime(item.updated_at) }}</p>
            </div>
            <div class="ops-card__actions">
              <el-button size="small" type="primary" plain @click.stop="openDetail(item)">详情</el-button>
              <el-button size="small" plain @click.stop="openEdit(item)">编辑</el-button>
              <el-button size="small" plain @click.stop="openDeploy(item)">部署</el-button>
              <el-button size="small" plain @click.stop="handleExportRow(item)">导出</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <DataTablePanel
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        :loading="loading"
        @change="loadProjects"
      >
        <template #default="{ bodyHeight }">
          <el-table
            v-loading="loading"
            :data="projects"
            :height="bodyHeight"
            row-key="id"
            @sort-change="handleSortChange"
          >
            <el-table-column prop="name" label="项目名称" min-width="180" sortable="custom" />
            <el-table-column prop="project_type" label="类型" width="110" sortable="custom">
              <template #default="{ row }">{{ typeLabel(row.project_type) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="statusMeta(row.status).type" effect="light">
                  {{ statusMeta(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="结构" min-width="200">
              <template #default="{ row }">
                目录 {{ countTreeNodes(row.directory_tree) }} /
                路由 {{ countRoutes(row.routes) }} /
                节点 {{ countFlowNodes(row.flows) }}
              </template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="170" sortable="custom">
              <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="320" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row)">详情</el-button>
                <el-button link @click="openEdit(row)">编辑</el-button>
                <el-button link @click="openDeploy(row)">部署</el-button>
                <el-button link @click="handleExportRow(row)">导出</el-button>
                <el-popconfirm title="确定删除该项目？" @confirm="handleDelete(row)">
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

  </PageShell>

  <el-dialog
    v-model="importDlg.visible"
    title="导入项目配置"
    width="480px"
    :close-on-click-modal="!importDlg.running"
    :close-on-press-escape="!importDlg.running"
    :show-close="!importDlg.running"
    destroy-on-close
  >
    <el-progress :percentage="importDlg.percent" :status="importDlg.error ? 'exception' : importDlg.done ? 'success' : undefined" />
    <p class="ops-import-msg">{{ importDlg.message }}</p>
    <el-alert v-if="importDlg.error" type="error" :title="importDlg.error" show-icon :closable="false" />
    <p v-if="importDlg.done && importDlg.name" class="ops-import-done">
      已创建：
      <el-button link type="primary" @click="goImported">{{ importDlg.name }}</el-button>
    </p>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import {
  createImportJob,
  deleteProject,
  exportProject,
  fetchProjectTemplate,
  fetchProjects,
  importJobStreamUrl,
  importProject,
} from '../services/opsService.js';
import {
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  countFlowNodes,
  countRoutes,
  countTreeNodes,
  coverFallback,
  downloadJson,
  formatDateTime,
  statusMeta,
  typeLabel,
} from '../utils/opsMeta.js';

const route = useRoute();
const router = useRouter();
const viewMode = ref('board');
const viewOptions = [
  { label: '看板', value: 'board' },
  { label: '表格', value: 'table' },
];
const loading = ref(false);
const loadError = ref('');
const projects = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(12);
const sortBy = ref('updated_at');
const sortOrder = ref('desc');
const filters = reactive({
  name: '',
  project_type: '',
  status: '',
});

function readQuery() {
  filters.name = String(route.query.name || '');
  filters.project_type = String(route.query.project_type || '');
  filters.status = String(route.query.status || '');
  page.value = Number(route.query.page) || 1;
  pageSize.value = Number(route.query.pageSize) || 12;
  viewMode.value = route.query.view === 'table' ? 'table' : 'board';
  sortBy.value = String(route.query.sortBy || 'updated_at');
  sortOrder.value = String(route.query.sortOrder || 'desc');
}

function writeQuery(extra = {}) {
  router.replace({
    query: {
      name: filters.name || undefined,
      project_type: filters.project_type || undefined,
      status: filters.status || undefined,
      page: String(page.value),
      pageSize: String(pageSize.value),
      view: viewMode.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...extra,
    },
  });
}

async function loadProjects() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchProjects({
      name: filters.name,
      project_type: filters.project_type,
      status: filters.status,
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    });
    projects.value = data.list || [];
    total.value = data.total || 0;
  } catch (err) {
    loadError.value = err.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  writeQuery();
}

function resetFilters() {
  filters.name = '';
  filters.project_type = '';
  filters.status = '';
  page.value = 1;
  writeQuery();
}

function reload() {
  loadProjects();
}

function handleSortChange({ prop, order }) {
  sortBy.value = prop || 'updated_at';
  sortOrder.value = order === 'ascending' ? 'asc' : 'desc';
  writeQuery();
}

function openDetail(item) {
  router.push({ name: 'ops-detail', params: { id: String(item.id) } });
}

function openEdit(item) {
  router.push({ name: 'ops-edit', params: { id: String(item.id) } });
}

function openDeploy(item) {
  router.push({ name: 'ops-deploy', params: { id: String(item.id) } });
}

function goCreate() {
  router.push({ name: 'ops-create' });
}

function goJobs() {
  router.push({ name: 'ops-deploy-jobs' });
}

async function handleExportTemplate() {
  try {
    const template = await fetchProjectTemplate();
    if (!template || typeof template !== 'object') {
      throw new Error('模板接口未返回数据');
    }
    downloadJson('ops-project-template.json', template);
    ElMessage.success('已导出空白模板，按字段说明填写后可再导入');
  } catch (err) {
    ElMessage.error(err.message || '导出模板失败');
  }
}

async function handleExportRow(item) {
  try {
    const doc = await exportProject(item.id);
    downloadJson(`${item.name || 'ops-project'}.json`, doc);
    ElMessage.success('已导出项目配置');
  } catch (err) {
    ElMessage.error(err.message || '导出失败');
  }
}

const SMALL_IMPORT_BYTES = 256 * 1024;
const importDlg = reactive({
  visible: false,
  running: false,
  done: false,
  percent: 0,
  message: '',
  error: '',
  name: '',
  projectId: null,
});
let importSource = null;

function resetImportDlg() {
  importSource?.close();
  importSource = null;
  Object.assign(importDlg, {
    visible: true,
    running: true,
    done: false,
    percent: 8,
    message: '读取文件…',
    error: '',
    name: '',
    projectId: null,
  });
}

function finishImportOk(name, projectId) {
  importDlg.running = false;
  importDlg.done = true;
  importDlg.percent = 100;
  importDlg.message = '导入完成';
  importDlg.name = name;
  importDlg.projectId = projectId;
  ElMessage.success(`已导入「${name}」`);
  loadProjects();
}

function finishImportErr(message) {
  importDlg.running = false;
  importDlg.error = message || '导入失败，请检查 JSON 是否符合模板';
  importDlg.message = '导入失败';
}

function goImported() {
  if (!importDlg.projectId) return;
  importDlg.visible = false;
  router.push({ name: 'ops-detail', params: { id: String(importDlg.projectId) } });
}

async function importSmall(parsed) {
  importDlg.percent = 25;
  importDlg.message = '解析文档';
  await new Promise((r) => setTimeout(r, 80));
  importDlg.percent = 55;
  importDlg.message = '校验模板';
  await new Promise((r) => setTimeout(r, 80));
  importDlg.percent = 85;
  importDlg.message = '写入项目库';
  const created = await importProject(parsed);
  finishImportOk(created.name, created.id);
}

function importLarge(parsed) {
  return createImportJob(parsed).then(({ job }) => new Promise((resolve, reject) => {
    const url = importJobStreamUrl(job.id);
    importSource = new EventSource(url);
    importSource.addEventListener('phase', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        importDlg.percent = Number(data.percent) || importDlg.percent;
        importDlg.message = data.message || data.phase || importDlg.message;
      } catch { /* ignore */ }
    });
    importSource.addEventListener('done', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        finishImportOk(data.name, data.project_id);
        resolve();
      } catch (err) {
        finishImportErr(err.message);
        reject(err);
      }
      importSource?.close();
      importSource = null;
    });
    importSource.addEventListener('fail', (ev) => {
      let message = '导入失败';
      try {
        message = JSON.parse(ev.data)?.message || message;
      } catch { /* ignore */ }
      finishImportErr(message);
      reject(new Error(message));
      importSource?.close();
      importSource = null;
    });
    importSource.addEventListener('end', () => {
      importSource?.close();
      importSource = null;
      if (importDlg.running) finishImportErr('导入中断');
    });
  }));
}

function handleImport(file) {
  resetImportDlg();
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      if (file.size < SMALL_IMPORT_BYTES) await importSmall(parsed);
      else await importLarge(parsed);
    } catch (err) {
      finishImportErr(err.message || '导入失败，请检查 JSON 是否符合模板');
    }
  };
  reader.onerror = () => finishImportErr('读取文件失败');
  reader.readAsText(file);
  return false;
}

async function handleDelete(row) {
  try {
    await deleteProject(row.id);
    ElMessage.success('已删除');
    await loadProjects();
  } catch (err) {
    ElMessage.error(err.message || '删除失败');
  }
}

watch(viewMode, (next) => {
  const current = route.query.view === 'table' ? 'table' : 'board';
  if (next === current) return;
  writeQuery();
});
watch(() => route.query, () => {
  readQuery();
  loadProjects();
}, { immediate: true });
</script>

<style scoped>
.ops-list-toolbar {
  margin-bottom: 12px;
}

.ops-list-error {
  margin-bottom: 12px;
}

.ops-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.ops-card {
  display: flex;
  flex-direction: column;
  background: var(--ops-color-surface);
  border: var(--ops-border-subtle);
  border-radius: var(--ops-radius-base);
  box-shadow: var(--ops-shadow-soft);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ops-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ops-shadow-soft);
}

.ops-card__cover {
  height: 88px;
  background: var(--ops-gradient-cover);
}

.ops-card__cover-fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--ops-color-primary);
}

.ops-card__body {
  padding: 14px 16px 8px;
  flex: 1;
}

.ops-card__title {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--ops-color-deep);
}

.ops-card__tags {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.ops-card__stats,
.ops-card__summary,
.ops-card__time {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--ops-color-text-secondary);
}

.ops-card__summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.ops-card__actions {
  display: flex;
  gap: 8px;
  padding: 0 16px 14px;
}

.ops-import-msg,
.ops-import-done {
  margin: 12px 0 0;
  color: var(--ops-color-text);
}
</style>
