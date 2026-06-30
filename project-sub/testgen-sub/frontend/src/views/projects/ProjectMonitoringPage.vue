<template>
  <div v-loading="loading" class="project-monitor-page">
    <div class="toolbar">
      <el-button type="primary" :loading="refreshing" @click="refresh">刷新探活</el-button>
      <span class="last-check">上次检测：{{ lastCheck }}</span>
    </div>
    <el-empty v-if="!loading && !statuses.length" description="请先在「环境配置」中创建环境" />
    <el-row v-else :gutter="16">
      <el-col v-for="env in statuses" :key="env.env_id" :span="8" style="margin-bottom: 16px">
        <el-card shadow="never" :class="['env-health-card', env.overall]">
          <template #header>
            <div class="card-head">
              <span>{{ env.name }}</span>
              <el-tag :type="overallType(env.overall)" size="small">{{ overallLabel(env.overall) }}</el-tag>
            </div>
          </template>
          <div class="metric-row">
            <span>接口连通性</span>
            <el-tag :type="metricType(env.api)" size="small">{{ metricLabel(env.api) }}</el-tag>
          </div>
          <p v-if="env.api_message" class="metric-detail">{{ env.api_message }}</p>
          <p v-if="env.probe_url" class="metric-detail probe-url">{{ env.probe_url }}</p>
          <div class="metric-row">
            <span>数据库连接</span>
            <el-tag :type="metricType(env.db)" size="small">{{ metricLabel(env.db) }}</el-tag>
          </div>
          <p v-if="env.db_message" class="metric-detail">{{ env.db_message }}</p>
          <div v-if="env.load_pct != null" class="metric-row">
            <span>响应负载指数</span>
            <el-progress :percentage="env.load_pct" :status="env.load_pct > 80 ? 'exception' : undefined" />
          </div>
          <p v-if="env.latency_ms != null" class="latency">接口响应：{{ env.latency_ms }} ms</p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchProjectHealth } from '@/services/projectService.js';

const props = defineProps({
  project: { type: Object, required: true },
});

const loading = ref(false);
const refreshing = ref(false);
const statuses = ref([]);
const lastCheck = ref('-');

function metricType(v) {
  return { ok: 'success', warn: 'warning', fail: 'danger', skip: 'info' }[v] || 'info';
}

function metricLabel(v) {
  return { ok: '正常', warn: '告警', fail: '异常', skip: '未配置' }[v] || v;
}

function overallType(v) {
  return { healthy: 'success', degraded: 'warning', down: 'danger' }[v] || 'info';
}

function overallLabel(v) {
  return { healthy: '健康', degraded: '降级', down: '不可用' }[v] || v;
}

async function refresh() {
  refreshing.value = true;
  loading.value = !statuses.value.length;
  try {
    const data = await fetchProjectHealth(props.project.project_code);
    statuses.value = data.environments || [];
    lastCheck.value = data.checked_at
      ? new Date(data.checked_at).toLocaleString('zh-CN')
      : new Date().toLocaleString('zh-CN');
  } catch (e) {
    ElMessage.error(e.message || '探活失败');
  } finally {
    refreshing.value = false;
    loading.value = false;
  }
}

watch(() => props.project.project_code, refresh);
onMounted(refresh);
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.last-check {
  color: #909399;
  font-size: 13px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.metric-detail {
  color: #909399;
  font-size: 12px;
  margin: -6px 0 8px;
  word-break: break-all;
}
.probe-url {
  font-family: monospace;
}
.latency {
  color: #909399;
  font-size: 12px;
  margin: 8px 0 0;
}
.env-health-card.down {
  border-left: 3px solid #f56c6c;
}
.env-health-card.degraded {
  border-left: 3px solid #e6a23c;
}
.env-health-card.healthy {
  border-left: 3px solid #67c23a;
}
</style>
