<template>
  <div class="admin-page">
    <header class="admin-head">
      <div>
        <h1>日志</h1>
        <p>账号审计记录开通和权限。执行轨迹记录技能调用和生成等待，点开一条可以看节点。</p>
      </div>
      <el-button @click="refresh">刷新</el-button>
    </header>
    <el-tabs v-model="tab">
      <el-tab-pane label="账号审计" name="audit">
        <div class="admin-filters">
          <el-input v-model="query.q" clearable placeholder="操作人 / 对象" @keyup.enter="search" />
          <el-select v-model="query.action" clearable placeholder="动作" @change="search">
            <el-option label="开通" value="approve" />
            <el-option label="禁用" value="disabled" />
            <el-option label="改角色" value="set_role" />
            <el-option label="重置密码" value="reset_password" />
            <el-option label="改自己密码" value="change_password" />
            <el-option label="开启 MFA" value="mfa_enable" />
            <el-option label="关闭 MFA" value="mfa_disable" />
          </el-select>
          <el-button type="primary" @click="search">查询</el-button>
        </div>
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="created_at" label="时间" width="190" />
          <el-table-column prop="actor_username" label="操作人" width="140" />
          <el-table-column label="动作" width="140">
            <template #default="{ row }">{{ actionText(row.action) }}</template>
          </el-table-column>
          <el-table-column prop="target_username" label="对象" width="140" />
          <el-table-column prop="detail" label="详情" min-width="220" show-overflow-tooltip />
        </el-table>
        <div class="admin-pager">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="total"
            :page-size="query.pageSize"
            :current-page="query.page"
            @current-change="onPage"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane label="执行轨迹" name="trace">
        <div class="admin-filters">
          <el-select v-model="traceQuery.skill" clearable filterable placeholder="技能" @change="searchTrace">
            <el-option v-for="item in skills" :key="item.skill_name" :label="skillLabel(item)" :value="item.skill_name" />
          </el-select>
          <el-select v-model="traceQuery.status" clearable placeholder="结果" @change="searchTrace">
            <el-option label="进行中" value="running" />
            <el-option label="正常" value="ok" />
            <el-option label="异常" value="error" />
            <el-option label="跳过" value="skip" />
          </el-select>
          <el-button type="primary" @click="searchTrace">查询</el-button>
        </div>
        <el-table :data="traces" v-loading="traceLoading" stripe @row-click="openTrace">
          <el-table-column label="时间" width="180">
            <template #default="{ row }">{{ timeText(row.started_at) }}</template>
          </el-table-column>
          <el-table-column prop="skill_name" label="技能" min-width="180" show-overflow-tooltip />
          <el-table-column prop="title" label="标题" width="140" show-overflow-tooltip />
          <el-table-column prop="target_label" label="对象" width="120" show-overflow-tooltip />
          <el-table-column label="结果" width="100">
            <template #default="{ row }">
              <el-tag :type="tagType(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="120">
            <template #default="{ row }">{{ elapsedText(row.elapsed_ms) }}</template>
          </el-table-column>
          <el-table-column prop="error_text" label="说明" min-width="180" show-overflow-tooltip />
        </el-table>
        <div class="admin-pager">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="traceTotal"
            :page-size="traceQuery.pageSize"
            :current-page="traceQuery.page"
            @current-change="onTracePage"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
    <el-drawer v-model="drawer.open" :title="drawer.title" size="640px" append-to-body>
      <p v-if="drawer.loading" class="trace-hint">正在读取这条执行。</p>
      <template v-else>
        <div class="trace-flow">
          <button
            v-for="step in drawer.steps"
            :key="step.id"
            type="button"
            class="trace-node"
            :class="[ `is-${step.status}`, { 'is-active': drawer.stepId === step.id } ]"
            @click="drawer.stepId = step.id"
          >
            {{ step.title || step.node_key || '节点' }}
          </button>
        </div>
        <p v-if="!drawer.steps.length" class="trace-hint">这次执行还没有节点。</p>
        <template v-else-if="activeStep">
          <p class="trace-meta">{{ statusText(activeStep.status) }} · {{ elapsedText(activeStep.elapsed_ms) || '耗时未记' }}</p>
          <pre class="trace-log">{{ stepLog(activeStep) }}</pre>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchAuditLogs, fetchExecution, fetchExecutions, fetchExecutionSkills } from '../services/userService.js';

const MAP = {
  approve: '开通',
  disabled: '禁用',
  active: '启用',
  set_role: '改角色',
  reset_password: '重置密码',
  change_password: '改自己密码',
  mfa_enable: '开启 MFA',
  mfa_disable: '关闭 MFA',
};

const STATUS = {
  running: '进行中',
  ok: '正常',
  error: '异常',
  skip: '跳过',
};

const tab = ref('audit');
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const query = reactive({ q: '', action: '', page: 1, pageSize: 20 });
const traceLoading = ref(false);
const traces = ref([]);
const traceTotal = ref(0);
const skills = ref([]);
const traceQuery = reactive({ skill: '', status: '', page: 1, pageSize: 20 });
const drawer = reactive({
  open: false,
  loading: false,
  title: '执行轨迹',
  steps: [],
  stepId: 0,
});

const activeStep = computed(() => drawer.steps.find(step => step.id === drawer.stepId) || drawer.steps[0] || null);

function actionText(action) {
  return MAP[action] || action;
}

function statusText(status) {
  return STATUS[status] || status || '未知';
}

function tagType(status) {
  if (status === 'ok') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'running') return 'warning';
  return 'info';
}

function skillLabel(item) {
  return `${item.skill_name}（${item.total}）`;
}

function timeText(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function elapsedText(ms) {
  const value = Number(ms) || 0;
  if (value <= 0) return '';
  if (value < 1000) return `${value} 毫秒`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function stepLog(step) {
  const lines = [ step.log_text, step.error_text ].map(item => String(item || '').trim()).filter(Boolean);
  return lines.join('\n') || '这个节点没有留下日志。';
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchAuditLogs(query);
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (err) {
    ElMessage.error(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadSkills() {
  try {
    const data = await fetchExecutionSkills();
    skills.value = data.list || [];
  } catch (err) {
    ElMessage.error(err.message || '技能列表没有读到');
  }
}

async function loadTrace() {
  traceLoading.value = true;
  try {
    const data = await fetchExecutions(traceQuery);
    traces.value = data.list || [];
    traceTotal.value = data.total || 0;
  } catch (err) {
    ElMessage.error(err.message || '执行轨迹没有读到');
  } finally {
    traceLoading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

function onPage(page) {
  query.page = page;
  load();
}

function searchTrace() {
  traceQuery.page = 1;
  loadTrace();
}

function onTracePage(page) {
  traceQuery.page = page;
  loadTrace();
}

function refresh() {
  if (tab.value === 'trace') {
    loadSkills();
    loadTrace();
    return;
  }
  load();
}

async function openTrace(row) {
  drawer.open = true;
  drawer.loading = true;
  drawer.title = [ row.title, row.target_label ].filter(Boolean).join(' · ') || row.skill_name || '执行轨迹';
  drawer.steps = [];
  drawer.stepId = 0;
  try {
    const data = await fetchExecution(row.id);
    const steps = data.steps || [];
    drawer.steps = steps;
    const failed = steps.find(step => step.status === 'error');
    drawer.stepId = (failed || steps[steps.length - 1] || {}).id || 0;
  } catch (err) {
    ElMessage.error(err.message || '这条执行没有读到');
  } finally {
    drawer.loading = false;
  }
}

watch(tab, (name) => {
  if (name === 'trace' && !traces.value.length && !traceLoading.value) {
    loadSkills();
    loadTrace();
  }
});

onMounted(load);
</script>

<style scoped>
.trace-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.trace-node {
  border: 1px solid #d7e3db;
  background: #f7fbf8;
  color: #1f3d2c;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.trace-node.is-ok {
  border-color: #2f8a5b;
}

.trace-node.is-error {
  border-color: #c45656;
  background: #fff1f0;
}

.trace-node.is-running {
  border-color: #b88230;
  background: #fff8eb;
}

.trace-node.is-skip {
  color: #6b7280;
}

.trace-node.is-active {
  outline: 2px solid #2f8a5b;
}

.trace-meta,
.trace-hint {
  margin: 0 0 8px;
  color: #5c6b62;
}

.trace-log {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  background: #f7fbf8;
  border-radius: 8px;
}
</style>
