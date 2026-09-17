<template>
  <PageShell title="部署">
    <template #extra>
      <el-button link @click="goDetail">← 返回详情</el-button>
      <el-button @click="goHistory">部署历史</el-button>
      <el-button @click="goJobs">任务总览</el-button>
    </template>
    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="ops-deploy-alert"
    >
      <el-button link type="primary" @click="load">重试</el-button>
    </el-alert>
    <template v-else-if="project.id">
      <div class="ops-deploy-head">
        <h4 class="ops-page-title">{{ project.name }}</h4>
        <el-tag size="small">{{ typeLabel(project.project_type) }}</el-tag>
        <el-tag size="small" :type="statusMeta(project.status).type" effect="light">
          {{ statusMeta(project.status).label }}
        </el-tag>
      </div>

      <el-alert
        v-if="activeJob"
        type="warning"
        class="ops-deploy-alert"
        show-icon
        :closable="false"
      >
        <template #title>
          部署 #{{ activeJob.id }} 进行中（{{ activeJob.git_tag }}）
        </template>
        <el-button link type="primary" @click="goLog(activeJob.id)">进入黑窗口</el-button>
        <el-button link type="danger" :loading="aborting" @click="onAbort">中止</el-button>
      </el-alert>

      <el-alert
        v-if="codeSource === 'github' && !project.repo_url"
        type="info"
        title="GitHub 部署需要 HTTPS 仓库地址，例如 https://github.com/org/repo.git"
        show-icon
        :closable="false"
        class="ops-deploy-alert"
      />

      <el-card shadow="never" class="ops-deploy-card">
        <template #header>代码来源</template>
        <el-radio-group v-model="codeSource">
          <el-radio-button label="local">本地 source_path</el-radio-button>
          <el-radio-button label="github">GitHub</el-radio-button>
        </el-radio-group>
        <p v-if="codeSource === 'local'" class="ops-deploy-hint">
          从宿主机拷贝工程。容器须挂 HOST_PROJECTS_ROOT。Agent 项目请指到仓库根（含 deploy/scripts/run.mjs），不要只指 .pi。
        </p>
        <el-form v-if="codeSource === 'local'" label-position="top" class="ops-github-form">
          <el-form-item label="本地 source_path">
            <el-input v-model="project.source_path" placeholder="例如 E:/AI Tools/projects/fitness/fitness-agent" />
          </el-form-item>
        </el-form>
        <template v-else>
          <p class="ops-deploy-hint">
            填写本次发布 tag。若远程没有该 tag，一键部署会在分支 <code>{{ gitBranch }}</code> 的 HEAD 自动创建并推送；已存在且指向同一提交则直接使用。
            Token 存在个人信息中，本页不重复填写。
          </p>
          <el-form label-position="top" class="ops-github-form">
            <el-form-item label="GitHub HTTPS 仓库">
              <el-input v-model="project.repo_url" placeholder="https://github.com/org/repo.git" />
            </el-form-item>
            <el-form-item label="部署分支">
              <el-input v-model="gitBranch" placeholder="main" />
            </el-form-item>
            <el-form-item label="发布 tag">
              <div class="ops-deploy-tag-row">
                <el-select
                  v-model="gitTag"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="例如 v0.0.2，可新建"
                  style="width: 280px"
                >
                  <el-option v-for="item in tags" :key="item.name" :label="item.name" :value="item.name" />
                </el-select>
                <el-button :loading="tagsLoading" @click="loadTags">刷新已有标签</el-button>
              </div>
              <p v-if="tagsMessage" class="ops-deploy-hint">{{ tagsMessage }}</p>
            </el-form-item>
            <p class="ops-deploy-hint">
              GitHub Token：{{ githubReady ? `已保存在个人信息${githubLogin ? `（${githubLogin}）` : ''}` : '尚未配置，点一键部署时会弹出填写并写入个人信息' }}
              ；需含 Contents: Read + Write（或 classic repo）。
            </p>
          </el-form>
        </template>
      </el-card>

      <el-card shadow="never" class="ops-deploy-card">
        <template #header>部署配置</template>
        <p class="ops-deploy-hint">按产品填模块。AgentRun 把本地 ~/.s 与 .env.prod 收进项目，线上执行不再依赖本机环境。</p>
        <OpsDeployProductForm
          v-model="deployConfig"
          :products="products"
          :defaults="productDefaults"
        />
        <el-button class="ops-save-cfg" :loading="saving" @click="onSaveConfig">保存配置</el-button>
      </el-card>

      <el-card v-if="deployConfig.product === 'generic' && codeSource === 'github'" shadow="never" class="ops-deploy-card">
        <template #header>构建参数</template>
        <OpsDeployForm v-model="params" :project-type="project.project_type" />
      </el-card>

      <div class="ops-action-bar">
        <el-button
          type="primary"
          :disabled="!!activeJob"
          :loading="submitting"
          @click="onSubmit"
        >
          一键部署
        </el-button>
        <span v-if="activeJob" class="ops-action-bar__hint">有进行中任务时不能再提交</span>
      </div>
    </template>
    <el-dialog
      v-model="tokenDialog.visible"
      title="填写 GitHub Token"
      width="480px"
      :close-on-click-modal="false"
    >
      <p class="ops-deploy-hint">
        将写入当前登录用户的个人信息，下次一键部署直接使用，不必再填。
        需要能读写该仓库的 PAT（classic 勾选 repo；或 fine-grained：Contents Read + Write，用于自动打 tag）。
      </p>
      <el-form label-position="top">
        <el-form-item label="GitHub 用户名（选填）">
          <el-input v-model="tokenDialog.github_login" placeholder="例如 octocat" />
        </el-form-item>
        <el-form-item label="Personal Access Token" required>
          <el-input v-model="tokenDialog.token" type="password" show-password placeholder="ghp_… 或 github_pat_…" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeTokenDialog">取消</el-button>
        <el-button type="primary" :loading="tokenDialog.saving" @click="confirmGithubToken">确认并继续部署</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import OpsDeployForm from '../components/ops/OpsDeployForm.vue';
import OpsDeployProductForm from '../components/ops/OpsDeployProductForm.vue';
import { fetchProject, updateProject } from '../services/opsService.js';
import {
  abortDeployJob,
  createDeployJob,
  fetchDeployProducts,
  fetchGithubProfile,
  fetchGitTags,
  fetchProjectDeployJobs,
  saveGithubToken,
} from '../services/opsDeployService.js';
import { statusMeta, typeLabel } from '../utils/opsMeta.js';
import {
  defaultDeployParams,
  FALLBACK_DEPLOY_PRODUCTS,
  parseDeployProductCatalog,
} from '../utils/deployMeta.js';

const route = useRoute();
const router = useRouter();
const loadError = ref('');
const project = reactive({
  id: null,
  name: '',
  project_type: 'frontend',
  status: 'draft',
  repo_url: '',
  source_path: '',
  description: '',
});
const gitTag = ref('');
const gitBranch = ref('main');
const codeSource = ref('local');
const githubReady = ref(false);
const githubLogin = ref('');
const tags = ref([]);
const tagsMessage = ref('');
const tagsLoading = ref(false);
const params = reactive(defaultDeployParams('frontend'));
const deployConfig = ref({ product: 'generic' });
const products = ref(FALLBACK_DEPLOY_PRODUCTS);
const productDefaults = ref({});
const activeJob = ref(null);
const submitting = ref(false);
const saving = ref(false);
const aborting = ref(false);
const tokenDialog = reactive({
  visible: false,
  saving: false,
  token: '',
  github_login: '',
  pending: false,
});
let pollTimer = null;

function applyParams(type) {
  Object.assign(params, defaultDeployParams(type));
}

function goDetail() {
  router.push({ name: 'ops-detail', params: { id: String(project.id || route.params.id) } });
}

function goHistory() {
  router.push({ name: 'ops-deploy-history', params: { id: String(project.id || route.params.id) } });
}

function goJobs() {
  router.push({ name: 'ops-deploy-jobs' });
}

function goLog(jobId) {
  router.push({
    name: 'ops-deploy-log',
    params: { id: String(project.id || route.params.id), jobId: String(jobId) },
  });
}

async function loadActive() {
  const data = await fetchProjectDeployJobs(route.params.id, {
    status: 'queued,running',
    pageSize: 1,
  });
  activeJob.value = data.list?.[0] || null;
}

async function loadTags() {
  tagsLoading.value = true;
  try {
    const data = await fetchGitTags(route.params.id, { repo_url: project.repo_url });
    tags.value = data.list || [];
    tagsMessage.value = data.message || '';
    if (!gitTag.value && tags.value[0]) gitTag.value = tags.value[0].name;
  } catch (err) {
    ElMessage.error(err.message || '拉取标签失败');
  } finally {
    tagsLoading.value = false;
  }
}

async function load() {
  loadError.value = '';
  try {
    const data = await fetchProject(route.params.id);
    project.id = data.id;
    project.name = data.name;
    project.project_type = data.project_type;
    project.status = data.status;
    project.repo_url = data.repo_url;
    project.source_path = data.source_path;
    project.description = data.description;
    applyParams(data.project_type);
    try {
      const catalog = parseDeployProductCatalog(await fetchDeployProducts());
      products.value = catalog.list;
      productDefaults.value = catalog.defaults || {};
    } catch (err) {
      products.value = FALLBACK_DEPLOY_PRODUCTS;
      ElMessage.warning(err.message || '部署产品目录接口不可用，已使用内置选项');
    }
    deployConfig.value = data.deploy_config && data.deploy_config.product
      ? data.deploy_config
      : { ...(productDefaults.value || {}), product: data.project_type === 'agent' ? 'agentrun' : 'generic' };
    codeSource.value = deployConfig.value.code_source === 'github' ? 'github' : 'local';
    gitBranch.value = deployConfig.value.git_branch || 'main';
    if (deployConfig.value.git_tag) gitTag.value = deployConfig.value.git_tag;
    await Promise.all([loadActive(), refreshGithubProfile()]);
  } catch (err) {
    loadError.value = err.message || '项目不存在';
  }
}

async function refreshGithubProfile() {
  try {
    const data = await fetchGithubProfile();
    githubReady.value = !!data.github_token_configured;
    githubLogin.value = data.github_login || '';
  } catch {
    githubReady.value = false;
  }
}

function syncedDeployConfig() {
  return {
    ...deployConfig.value,
    code_source: codeSource.value,
    git_branch: gitBranch.value || 'main',
    git_tag: codeSource.value === 'github' ? gitTag.value.trim() : (deployConfig.value.git_tag || ''),
  };
}

async function persistConfig() {
  const next = syncedDeployConfig();
  const saved = await updateProject(project.id, {
    name: project.name,
    type: project.project_type,
    description: project.description,
    repo_url: project.repo_url,
    source_path: project.source_path,
    status: project.status,
    deploy_config: next,
  });
  if (saved.deploy_config) deployConfig.value = saved.deploy_config;
}

async function onSaveConfig() {
  saving.value = true;
  try {
    await persistConfig();
    ElMessage.success('部署配置已写入项目');
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function submitDeploy(extra = {}) {
  const product = deployConfig.value.product || 'generic';
  const data = await createDeployJob(project.id, {
    code_source: codeSource.value,
    git_branch: gitBranch.value || 'main',
    repo_url: project.repo_url,
    git_tag: codeSource.value === 'local' ? 'source' : gitTag.value.trim(),
    params: { ...params, product },
    deploy_config: syncedDeployConfig(),
    ...extra,
  });
  goLog(data.job.id);
}

async function onSubmit() {
  if (codeSource.value === 'github') {
    if (!/^https?:\/\/github\.com\//i.test(String(project.repo_url || ''))) {
      ElMessage.warning('请填写 GitHub HTTPS 仓库地址');
      return;
    }
    if (!gitTag.value.trim()) {
      ElMessage.warning('请选择或填写 tag');
      return;
    }
  }
  if (params.env === 'production') {
    try {
      await ElMessageBox.confirm('将按 production 发起部署，确认继续？', '二次确认', { type: 'warning' });
    } catch {
      return;
    }
  }
  submitting.value = true;
  try {
    await persistConfig();
    if (codeSource.value === 'github') {
      await refreshGithubProfile();
      if (!githubReady.value) {
        tokenDialog.token = '';
        tokenDialog.github_login = githubLogin.value;
        tokenDialog.visible = true;
        tokenDialog.pending = true;
        submitting.value = false;
        return;
      }
    }
    await submitDeploy();
  } catch (err) {
    if (String(err.message || '').includes('未配置 GitHub Token')) {
      tokenDialog.token = '';
      tokenDialog.github_login = githubLogin.value;
      tokenDialog.visible = true;
      tokenDialog.pending = true;
    } else {
      ElMessage.error(err.message || '创建部署失败');
    }
  } finally {
    submitting.value = false;
  }
}

async function confirmGithubToken() {
  if (!String(tokenDialog.token || '').trim()) {
    ElMessage.warning('请填写 GitHub Token');
    return;
  }
  tokenDialog.saving = true;
  try {
    await saveGithubToken({
      token: tokenDialog.token.trim(),
      github_login: tokenDialog.github_login,
    });
    githubReady.value = true;
    githubLogin.value = tokenDialog.github_login || githubLogin.value;
    const token = tokenDialog.token.trim();
    const login = tokenDialog.github_login;
    const pending = tokenDialog.pending;
    tokenDialog.visible = false;
    tokenDialog.token = '';
    tokenDialog.pending = false;
    if (pending) {
      submitting.value = true;
      await persistConfig();
      await submitDeploy({ github_token: token, github_login: login });
    } else {
      ElMessage.success('GitHub Token 已保存');
    }
  } catch (err) {
    ElMessage.error(err.message || '保存 Token 或部署失败');
  } finally {
    tokenDialog.saving = false;
    submitting.value = false;
  }
}

async function onAbort() {
  try {
    await ElMessageBox.confirm(`中止部署 #${activeJob.value.id}？`, '确认', { type: 'warning' });
  } catch {
    return;
  }
  aborting.value = true;
  try {
    await abortDeployJob(activeJob.value.id);
    ElMessage.success('已中止');
    await loadActive();
  } catch (err) {
    ElMessage.error(err.message || '中止失败');
  } finally {
    aborting.value = false;
  }
}

function closeTokenDialog() {
  tokenDialog.visible = false;
  tokenDialog.pending = false;
  tokenDialog.token = '';
}

watch(codeSource, (value) => {
  if (value === 'github' && project.id) loadTags();
});

onMounted(() => {
  load();
  pollTimer = setInterval(() => {
    if (project.id) loadActive();
  }, 5000);
});
onBeforeUnmount(() => clearInterval(pollTimer));
</script>

<style scoped>
.ops-deploy-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.ops-deploy-alert {
  margin-bottom: 16px;
}

.ops-deploy-card {
  margin-bottom: 16px;
  border: var(--ops-border-subtle, 1px solid rgba(47, 138, 91, 0.12));
}

.ops-deploy-hint {
  margin: 0 0 12px;
  color: var(--ops-color-text-secondary, #5c6b62);
  font-size: 13px;
}

.ops-deploy-tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ops-save-cfg {
  margin-top: 8px;
}

.ops-github-form {
  margin-top: 12px;
  max-width: 640px;
}
</style>
