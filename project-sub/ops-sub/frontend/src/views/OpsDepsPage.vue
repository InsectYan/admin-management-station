<template>
  <PageShell title="依赖健康">
    <template #extra>
      <el-button :loading="watching" @click="watchNow">立即巡检</el-button>
      <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
    </template>
    <el-alert
      type="info"
      title="卡片颜色是当前一次探测。连续两次巡检失败才会生成告警。"
      show-icon
      :closable="false"
      class="ops-deps-note"
    />
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <div class="ops-dep-grid">
      <el-card v-for="item in deps" :key="item.key" shadow="never" :class="item.up ? 'ops-dep-card is-up' : 'ops-dep-card is-down'">
        <div class="ops-dep-name">{{ item.name }}</div>
        <el-tag size="small" :type="item.up ? 'success' : 'danger'">{{ item.up ? '正常' : '不可用' }}</el-tag>
        <div class="ops-dep-meta">{{ item.up ? `${item.latency_ms} ms` : item.message }}</div>
        <div class="ops-dep-meta">连续失败 {{ item.fail_streak || 0 }} / 2</div>
      </el-card>
    </div>
  </PageShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchContentDeps, runContentWatch } from '../services/contentOpsService.js';

const deps = ref([]);
const loading = ref(false);
const watching = ref(false);
const loadError = ref('');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchContentDeps();
    deps.value = Array.isArray(data) ? data : (data.deps || []);
    if (!Array.isArray(data)) arm(data.probe_interval_sec);
  } catch (err) {
    loadError.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function watchNow() {
  watching.value = true;
  try {
    const data = await runContentWatch();
    deps.value = data.deps || [];
    ElMessage.success(`巡检完成，未关闭告警 ${data.open_alerts}`);
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    watching.value = false;
  }
}

let timer;
let currentInterval = 0;
function arm(seconds) {
  const next = Math.min(3600, Math.max(15, Number(seconds) || 15));
  if (timer && next === currentInterval) return;
  currentInterval = next;
  clearInterval(timer);
  timer = setInterval(load, next * 1000);
}
onMounted(() => {
  load();
  arm(15);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.ops-deps-note {
  margin-bottom: 16px;
}
.ops-dep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
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
</style>
