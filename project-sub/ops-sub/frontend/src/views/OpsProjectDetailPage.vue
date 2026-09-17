<template>
  <div class="ops-detail-page">
    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="ops-detail-error"
    >
      <el-button link type="primary" @click="load">重试</el-button>
    </el-alert>
    <OpsDetailShell
      v-else-if="form.id"
      :title="form.name"
      :description="form.description"
      :project-type="form.project_type"
      :status="form.status"
      :tab-title="currentTab?.label"
      :saving="saving"
      :fill-pane="tab === 4"
      :readonly="readonly"
      @back="goBack"
      @save="save"
      @export="handleExport"
      @edit="goEdit"
      @deploy="goDeploy"
      @jobs="goJobs"
    >
      <template #tabs>
        <OpsDetailTabs :active="tab" :items="tabs" @change="goToTab" />
      </template>
      <DetailBasicInfo v-if="tab === 1" :form="form" :readonly="readonly">
        <OpsGeneratePanel
          v-if="!readonly"
          :source-path="form.source_path"
          :basic="form"
          :project-id="form.id"
          apply-after
          @applied="applyProject"
        />
      </DetailBasicInfo>
      <DetailDirectory
        v-else-if="tab === 2"
        v-model="form.directory_tree"
        :readonly="readonly"
        :flows="form.flows"
        @enter-flow="openFlow"
      />
      <DetailRoutes
        v-else-if="tab === 3"
        v-model="form.routes"
        :disabled="false"
        :readonly="readonly"
        :flows="form.flows"
        @enter-flow="openFlow"
      />
      <DetailFlowChart
        v-else-if="tab === 4"
        v-model:flows="form.flows"
        :readonly="readonly"
        :active-key="activeFlowKey"
        :project-name="form.name"
        :project-id="form.id"
        @update:active-key="activeFlowKey = $event"
      />
    </OpsDetailShell>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import OpsDetailShell from '../components/ops/OpsDetailShell.vue';
import OpsDetailTabs from '../components/ops/OpsDetailTabs.vue';
import DetailBasicInfo from '../components/ops/DetailBasicInfo.vue';
import DetailDirectory from '../components/ops/DetailDirectory.vue';
import DetailRoutes from '../components/ops/DetailRoutes.vue';
import DetailFlowChart from '../components/ops/DetailFlowChart.vue';
import OpsGeneratePanel from '../components/ops/OpsGeneratePanel.vue';
import { exportProject, fetchProject, updateProject } from '../services/opsService.js';
import { downloadJson, ensureOverviewFlow } from '../utils/opsMeta.js';

const route = useRoute();
const router = useRouter();
const loadError = ref('');
const saving = ref(false);
const tab = ref(1);
const activeFlowKey = ref('overview');
const form = reactive({
  id: null,
  name: '',
  project_type: 'frontend',
  status: 'draft',
  description: '',
  repo_url: '',
  source_path: '',
  directory_tree: [],
  routes: [],
  flows: [],
  created_at: '',
  updated_at: '',
});

const readonly = computed(() => route.name !== 'ops-edit');

const tabs = computed(() => [
  { id: 1, label: '基础信息' },
  { id: 2, label: '目录结构' },
  { id: 3, label: form.project_type === 'frontend' || form.project_type === 'fullstack' ? '路由信息' : 'HTTP 接口' },
  { id: 4, label: '功能流程' },
]);

const currentTab = computed(() => tabs.value.find((item) => item.id === tab.value));

function withKeys(nodes, prefix) {
  return (nodes || []).map((node, index) => ({
    ...node,
    __key: node.__key || `${prefix}-${index}-${node.name || 'item'}`,
    flow_key: node.flow_key || '',
    children: withKeys(node.children, `${prefix}-${index}`),
    meta: node.meta || { title: '', auth: false },
  }));
}

function applyProject(data) {
  form.id = data.id;
  form.name = data.name || '';
  form.project_type = data.project_type || 'frontend';
  form.status = data.status || 'draft';
  form.description = data.description || '';
  form.repo_url = data.repo_url || '';
  form.source_path = data.source_path || '';
  form.directory_tree = withKeys(data.directory_tree, 'dir');
  form.routes = withKeys(data.routes, 'route');
  form.flows = ensureOverviewFlow(data.flows?.length ? data.flows : []);
  form.created_at = data.created_at;
  form.updated_at = data.updated_at;
}

async function load() {
  loadError.value = '';
  try {
    const data = await fetchProject(route.params.id);
    applyProject(data);
  } catch (err) {
    loadError.value = err.message || '加载失败';
  }
}

function goBack() {
  router.push({ name: 'ops-list' });
}

function goDeploy() {
  router.push({ name: 'ops-deploy', params: { id: String(form.id) } });
}

function goJobs() {
  router.push({ name: 'ops-deploy-jobs' });
}

function goEdit() {
  router.push({
    name: 'ops-edit',
    params: { id: String(form.id) },
    query: { tab: String(tab.value), flow: activeFlowKey.value },
  });
}

function goToTab(next) {
  tab.value = next;
  router.replace({ query: { ...route.query, tab: String(next) } });
}

function openFlow(flowKey) {
  activeFlowKey.value = flowKey || 'overview';
  tab.value = 4;
  router.replace({ query: { ...route.query, tab: '4', flow: activeFlowKey.value } });
}

async function save() {
  saving.value = true;
  try {
    const saved = await updateProject(form.id, {
      name: form.name,
      type: form.project_type,
      status: form.status,
      description: form.description,
      repo_url: form.repo_url,
      source_path: form.source_path,
      directory_tree: form.directory_tree,
      routes: form.routes,
      flows: form.flows,
    });
    applyProject(saved);
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleExport() {
  try {
    const doc = await exportProject(form.id);
    downloadJson(`${form.name || 'ops-project'}.json`, doc);
    ElMessage.success('已导出项目配置');
  } catch (err) {
    ElMessage.error(err.message || '导出失败');
  }
}

watch(
  () => [ route.params.id, route.name ],
  () => {
    tab.value = Number(route.query.tab) || 1;
    activeFlowKey.value = String(route.query.flow || 'overview');
    load();
  },
  { immediate: true },
);
</script>

<style scoped>
.ops-detail-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.ops-detail-error {
  margin: 16px 20px;
}
</style>
