<template>
  <PageShell title="环境与服务端点" table-layout>
    <template #extra>
      <el-button type="primary" @click="openCreate">新增环境</el-button>
      <el-button @click="healthCheck">环境探活</el-button>
    </template>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px">
      <template #title>全局请求配置</template>
      在此配置所有 HTTP 请求自动携带的<strong>请求头</strong>与<strong>固定参数</strong>（如 token、session_id、turn_id），
      执行时合并进 TS-01-DET / 链路 / 接口模板请求。项目级变量另见「项目变量」页。
    </el-alert>
    <FitnessLabeledTable
      :data="envs"
      :columns="envColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    >
      <template #suffix>
        <el-table-column label="全局配置" width="100">
          <template #default="{ row }">
            <el-tag v-if="hasGlobalConfig(row)" size="small" type="success">已配置</el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>
    <el-dialog v-model="showForm" :title="editingId ? '编辑环境' : '新增环境'" width="640px">
      <el-form label-width="120px">
        <el-form-item label="名称">
          <el-input v-model="form.name" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="教练 BFF">
          <el-input v-model="form.bff_coach_url" placeholder="http://host.docker.internal:3001" />
        </el-form-item>
        <el-form-item label="CLI 工作区">
          <el-input
            v-model="form.cli_workspace_root"
            placeholder="Docker 默认 /fitness-agent"
          />
          <div class="field-hint">
            fitness-agent 仓库根目录；CLI 命令如 cd server && npm run test:stations 在此目录下执行
          </div>
        </el-form-item>
        <el-divider content-position="left">全局 HTTP 请求头 (global_headers)</el-divider>
        <el-form-item label="请求头 JSON">
          <el-input
            v-model="globalHeadersText"
            type="textarea"
            :rows="4"
            placeholder='{"Authorization":"Bearer xxx","X-Internal-Service-Key":"..."}'
          />
          <div class="field-hint">所有 HTTP 请求自动合并；用例/模板级 headers 可覆盖同名键</div>
        </el-form-item>
        <el-divider content-position="left">固定参数 (fixed_params)</el-divider>
        <el-form-item label="固定参数 JSON">
          <el-input
            v-model="fixedParamsText"
            type="textarea"
            :rows="4"
            placeholder='{"token":"...","session_id":"...","turn_id":"..."}'
          />
          <div class="field-hint">
            写入变量池，供 Path/Body/Headers 中 <code v-pre>{{key}}</code> 插值；与前置链路 extract 结果合并
          </div>
        </el-form-item>
        <el-divider content-position="left">CLI 鉴权 (auth_configured)</el-divider>
        <el-form-item label="DATABASE_URL">
          <el-input v-model="form.database_url" placeholder="CLI 测试用数据库连接串" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { api } from '@/services/apiConfig.js';
import { fetchEnvironments, updateEnvironment } from '@/services/fitnessService.js';

const loading = ref(false);
const envs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showForm = ref(false);
const editingId = ref(null);
const globalHeadersText = ref('{}');
const fixedParamsText = ref('{}');
const form = reactive({
  name: '',
  bff_coach_url: '',
  cli_workspace_root: '',
  database_url: '',
});

const envColumns = [
  { prop: 'name', label: '环境名称', minWidth: 140 },
  { prop: 'config_env_id', label: '配置项编码', width: 160 },
  { prop: 'bff_coach_url', label: '教练 BFF', minWidth: 200 },
  { prop: 'cli_workspace_root', label: 'CLI 工作区', minWidth: 160 },
];

function hasGlobalConfig(row) {
  const auth = row.auth_configured || {};
  return Boolean(
    Object.keys(auth.global_headers || {}).length
    || Object.keys(auth.fixed_params || {}).length,
  );
}

function resetForm() {
  form.name = '';
  form.bff_coach_url = '';
  form.cli_workspace_root = '';
  form.database_url = '';
  globalHeadersText.value = '{}';
  fixedParamsText.value = '{}';
  editingId.value = null;
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  form.name = row.name || '';
  form.bff_coach_url = row.bff_coach_url || '';
  form.cli_workspace_root = row.cli_workspace_root || '';
  const auth = row.auth_configured || {};
  form.database_url = auth.database_url || auth.DATABASE_URL || '';
  globalHeadersText.value = JSON.stringify(auth.global_headers || {}, null, 2);
  fixedParamsText.value = JSON.stringify(auth.fixed_params || {}, null, 2);
  showForm.value = true;
}

function buildAuthConfigured() {
  let global_headers = {};
  let fixed_params = {};
  try {
    global_headers = JSON.parse(globalHeadersText.value || '{}');
  } catch {
    throw new Error('全局请求头 JSON 格式无效');
  }
  try {
    fixed_params = JSON.parse(fixedParamsText.value || '{}');
  } catch {
    throw new Error('固定参数 JSON 格式无效');
  }
  const auth_configured = { global_headers, fixed_params };
  if (form.database_url) {
    auth_configured.database_url = form.database_url;
  }
  return auth_configured;
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchEnvironments({ page: page.value, pageSize: pageSize.value });
    envs.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function save() {
  try {
    const auth_configured = buildAuthConfigured();
    if (editingId.value) {
      await updateEnvironment(editingId.value, {
        bff_coach_url: form.bff_coach_url,
        cli_workspace_root: form.cli_workspace_root,
        auth_configured,
      });
      ElMessage.success('已更新');
    } else {
      await api.post('/fitness/environments', {
        name: form.name,
        bff_coach_url: form.bff_coach_url,
        cli_workspace_root: form.cli_workspace_root,
        auth_configured,
      });
      ElMessage.success('已创建');
    }
    showForm.value = false;
    resetForm();
    await load();
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  }
}

async function healthCheck() {
  try {
    await api.post('/fitness/environments/health-check');
  } catch (e) {
    ElMessage.warning(e.message || '探活引擎未开发');
  }
}

onMounted(load);
</script>

<style scoped>
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
.muted { color: #c0c4cc; }
</style>
