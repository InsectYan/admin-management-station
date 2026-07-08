<template>
  <PageShell title="接口模板" table-layout>
    <template #extra>
      <el-input
        v-model="keyword"
        placeholder="搜索名称 / 编码 / 路径"
        clearable
        style="width:240px;margin-right:8px"
        @keyup.enter="reload"
        @clear="reload"
      />
      <el-button style="margin-right:8px" @click="goAutoGen">自动化配置模板</el-button>
      <el-button style="margin-right:8px" @click="triggerConfigImport">导入配置</el-button>
      <el-button type="primary" @click="openCreate">新建接口模板</el-button>
      <input ref="configImportRef" type="file" accept=".json,application/json" style="display:none" @change="onConfigImport" />
    </template>
    <FitnessLabeledTable
      :data="rows"
      :columns="columns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
      @row-click="goDetail"
    >
      <template #suffix>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="goDetail(row)">编辑</el-button>
            <el-button link type="danger" @click.stop="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>

    <el-dialog v-model="showImport" title="从配置 JSON 创建接口模板" width="480px">
      <el-form label-width="100px">
        <el-form-item label="模板编码" required>
          <el-input v-model="importForm.template_code" placeholder="coach-turn-submit" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="importForm.name" />
        </el-form-item>
      </el-form>
      <p class="import-hint">将使用 JSON 中的 HTTP、入参、前置链路等完整配置创建模板</p>
      <template #footer>
        <el-button @click="showImport = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">创建并编辑</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreate" title="新建接口模板" width="480px">
      <el-form label-width="100px">
        <el-form-item label="模板编码" required>
          <el-input v-model="createForm.template_code" placeholder="coach-turn-submit" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="createForm.name" />
        </el-form-item>
        <el-form-item label="HTTP 方法">
          <el-select v-model="createForm.http_method" style="width:120px">
            <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="URL 路径">
          <el-input v-model="createForm.url_path" placeholder="/turns/submit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建并编辑</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import {
  createApiTemplate,
  deleteApiTemplate,
  fetchApiTemplates,
} from '@/services/fitnessService.js';
import {
  parseApiTemplateImportJson,
  toApiTemplatePayload,
} from '@/utils/apiTemplateParamBind.js';

const router = useRouter();
const loading = ref(false);
const creating = ref(false);
const importing = ref(false);
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const showCreate = ref(false);
const showImport = ref(false);
const configImportRef = ref(null);
const pendingImport = ref(null);
const methods = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ];
const createForm = reactive({
  template_code: '',
  name: '',
  http_method: 'POST',
  url_path: '/',
});
const importForm = reactive({
  template_code: '',
  name: '',
});

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'template_code', label: '编码', minWidth: 140 },
  { prop: 'name', label: '名称', minWidth: 160 },
  { prop: 'http_method', label: '方法', width: 80 },
  { prop: 'url_path', label: '路径', minWidth: 180 },
  { prop: 'project_code', label: '项目', width: 120 },
];

async function load() {
  loading.value = true;
  try {
    const data = await fetchApiTemplates({
      page: page.value,
      pageSize: pageSize.value,
      q: keyword.value || undefined,
    });
    rows.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function reload() {
  page.value = 1;
  load();
}

function openCreate() {
  createForm.template_code = '';
  createForm.name = '';
  createForm.http_method = 'POST';
  createForm.url_path = '/';
  showCreate.value = true;
}

async function submitCreate() {
  if (!createForm.template_code.trim() || !createForm.name.trim()) {
    ElMessage.warning('请填写模板编码与名称');
    return;
  }
  creating.value = true;
  try {
    const row = await createApiTemplate({ ...createForm });
    showCreate.value = false;
    ElMessage.success('已创建');
    router.push(`/config/api-templates/${row.id}`);
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

function goDetail(row) {
  router.push(`/config/api-templates/${row.id}`);
}

function goAutoGen() {
  router.push({ name: 'api-template-gen' });
}

function triggerConfigImport() {
  configImportRef.value?.click();
}

async function onConfigImport(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const imported = parseApiTemplateImportJson(await file.text());
    pendingImport.value = imported;
    importForm.template_code = imported.template_code
      ? `${imported.template_code}-import`
      : `api-import-${Date.now()}`;
    importForm.name = imported.name || importForm.template_code;
    showImport.value = true;
  } catch (e) {
    ElMessage.error(e.message || '导入失败');
  }
}

async function submitImport() {
  if (!pendingImport.value) return;
  if (!importForm.template_code.trim() || !importForm.name.trim()) {
    ElMessage.warning('请填写模板编码与名称');
    return;
  }
  importing.value = true;
  try {
    const payload = toApiTemplatePayload(pendingImport.value, {
      templateCode: importForm.template_code.trim(),
      name: importForm.name.trim(),
    });
    const row = await createApiTemplate(payload);
    showImport.value = false;
    pendingImport.value = null;
    ElMessage.success('已从配置创建接口模板');
    router.push(`/config/api-templates/${row.id}`);
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '创建失败');
  } finally {
    importing.value = false;
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`停用接口模板「${row.name}」？`, '确认');
  await deleteApiTemplate(row.id);
  ElMessage.success('已停用');
  await load();
}

onMounted(load);
</script>

<style scoped>
.import-hint {
  color: #909399;
  font-size: 12px;
  margin: 0;
}
</style>
