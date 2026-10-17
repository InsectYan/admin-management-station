<template>
  <PageShell title="运维总览">
    <template #extra>
      <el-select v-model="bizApp" style="width: 140px" @change="load">
        <el-option v-for="item in BIZ_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select
        v-model="projectId"
        clearable
        placeholder="漫剧项目"
        style="width: 200px"
        @change="load"
      >
        <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-button :loading="watching" @click="watchNow">立即巡检</el-button>
      <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
    </template>

    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <el-alert
      v-else-if="overview?.cartoon_error"
      type="warning"
      :title="overview.cartoon_error"
      show-icon
      :closable="false"
    />

    <div class="ops-summary-row">
      <el-statistic title="今日任务" :value="cartoon?.today_total || 0" />
      <el-statistic title="今日成功" :value="cartoon?.today_success || 0" />
      <el-statistic title="今日失败" :value="cartoon?.today_failed || 0" />
      <div class="ops-duration">
        <div class="ops-duration-label">平均耗时</div>
        <div class="ops-duration-value">{{ formatDuration(cartoon?.avg_duration_sec) }}</div>
      </div>
      <el-statistic title="队列堆积" :value="cartoon?.backlog || 0" />
      <el-statistic title="未关闭告警" :value="overview?.open_alerts || 0" />
    </div>

    <h4 class="ops-block-title">依赖健康</h4>
    <div class="ops-dep-grid">
      <el-card v-for="item in overview?.deps || []" :key="item.key" shadow="never" :class="item.up ? 'ops-dep-card is-up' : 'ops-dep-card is-down'">
        <div class="ops-dep-name">{{ item.name }}</div>
        <el-tag size="small" :type="item.up ? 'success' : 'danger'">{{ item.up ? '正常' : '不可用' }}</el-tag>
        <div class="ops-dep-meta">{{ item.up ? `${item.latency_ms} ms` : item.message }}</div>
      </el-card>
    </div>

    <h4 class="ops-block-title">最近失败</h4>
    <el-empty v-if="!(cartoon?.recent_failures || []).length" description="今天还没有失败任务" />
    <el-table v-else :data="cartoon.recent_failures" row-key="id" @row-click="openJob">
      <el-table-column prop="id" label="任务" width="80" />
      <el-table-column prop="project_name" label="项目" min-width="140" />
      <el-table-column label="类型" width="110">
        <template #default="{ row }">{{ kindLabel(row.kind) }}</template>
      </el-table-column>
      <el-table-column prop="error_message" label="错误" min-width="240" show-overflow-tooltip />
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
      </el-table-column>
    </el-table>

    <p v-if="overview?.deploy" class="ops-deploy-hint">
      部署：进行中 {{ overview.deploy.running }}，今日成功 {{ overview.deploy.success_today }}，今日失败 {{ overview.deploy.failed_today }}
    </p>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchContentOverview, fetchContentProjects, runContentWatch } from '../services/contentOpsService.js';
import { BIZ_OPTIONS, formatDuration, kindLabel } from '../utils/contentMeta.js';
import { formatDateTime } from '../utils/opsMeta.js';

const router = useRouter();
const loading = ref(false);
const watching = ref(false);
const loadError = ref('');
const overview = ref(null);
const projects = ref([]);
const bizApp = ref('platform');
const projectId = ref();
const cartoon = computed(() => overview.value?.cartoon);

async function loadProjects() {
  try {
    projects.value = await fetchContentProjects({ biz_app: 'cartoon' });
  } catch {
    projects.value = [];
  }
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    overview.value = await fetchContentOverview({
      biz_app: bizApp.value,
      project_id: projectId.value || undefined,
    });
  } catch (err) {
    loadError.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function watchNow() {
  watching.value = true;
  try {
    await runContentWatch();
    ElMessage.success('已巡检一次');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    watching.value = false;
  }
}

function openJob(row) {
  router.push(`/jobs/cartoon/${row.id}`);
}

let timer;
onMounted(async () => {
  await loadProjects();
  await load();
  timer = setInterval(load, 15000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.ops-summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 8px 0 20px;
  align-items: flex-end;
}
.ops-duration-label {
  color: var(--el-text-color-regular);
  font-size: 14px;
  margin-bottom: 4px;
}
.ops-duration-value {
  font-size: 20px;
  font-weight: 600;
}
.ops-block-title {
  margin: 8px 0 12px;
  font-size: 15px;
}
.ops-dep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.ops-dep-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ops-dep-card.is-down {
  border-color: #f56c6c;
}
.ops-dep-name {
  font-weight: 600;
}
.ops-dep-meta {
  color: #8a968e;
  font-size: 12px;
}
.ops-deploy-hint {
  margin-top: 16px;
  color: #8a968e;
  font-size: 13px;
}
</style>
