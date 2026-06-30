<template>
  <PageShell v-loading="loading">
    <template #extra>
      <el-button @click="router.push(`/projects/${encodeURIComponent(projectCode)}/edit`)">编辑项目</el-button>
      <el-button type="primary" @click="enterFitness">进入测试体系</el-button>
    </template>

    <div v-if="project" class="project-detail-header">
      <div>
        <h2 class="project-detail-title">{{ project.project_name }}</h2>
        <p class="project-detail-code">{{ project.project_code }} · {{ project.team || '未分配团队' }}</p>
      </div>
      <div class="project-stats">
        <el-statistic title="测试项" :value="project.stats?.test_item_count ?? 0" class="clickable-stat" @click="goItems" />
        <el-statistic title="测试计划" :value="project.stats?.test_plan_count ?? 0" />
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="概览" name="overview" />
      <el-tab-pane label="环境配置" name="environments" />
      <el-tab-pane label="全局变量" name="variables" />
      <el-tab-pane label="环境监控" name="monitoring" />
      <el-tab-pane label="环境同步" name="sync" />
    </el-tabs>

    <router-view v-if="project" :project="project" />
  </PageShell>
</template>

<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchProject } from '@/services/projectService.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const project = ref(null);

const projectCode = computed(() => route.params.projectCode);

const tabRouteMap = {
  overview: '',
  environments: 'environments',
  variables: 'variables',
  monitoring: 'monitoring',
  sync: 'sync',
};

const activeTab = computed({
  get() {
    const seg = route.path.split('/').pop();
    if (seg === projectCode.value) return 'overview';
    return Object.keys(tabRouteMap).find(k => tabRouteMap[k] === seg) || 'overview';
  },
  set(name) {
    onTabChange(name);
  },
});

function onTabChange(name) {
  const suffix = tabRouteMap[name];
  const base = `/projects/${encodeURIComponent(projectCode.value)}`;
  router.push(suffix ? `${base}/${suffix}` : base);
}

function enterFitness() {
  router.push('/fitness/dashboard');
}

function goItems() {
  if (!project.value) return;
  router.push({
    path: '/testgen/items',
    query: { project_code: project.value.project_code },
  });
}

async function load() {
  loading.value = true;
  try {
    project.value = await fetchProject(projectCode.value);
  } finally {
    loading.value = false;
  }
}

provide('currentProject', project);

watch(projectCode, load);
onMounted(load);
</script>

<style scoped>
.project-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 24px;
}
.project-detail-title {
  margin: 0;
  font-size: 22px;
}
.project-detail-code {
  color: #909399;
  margin: 4px 0 0;
}
.project-stats {
  display: flex;
  gap: 32px;
}
.clickable-stat {
  cursor: pointer;
}
.clickable-stat:hover :deep(.el-statistic__head),
.clickable-stat:hover :deep(.el-statistic__content) {
  color: #409eff;
}
</style>
