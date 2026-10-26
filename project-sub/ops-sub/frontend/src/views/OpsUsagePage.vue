<template>
  <PageShell title="用量">
    <section class="ops-section">
    <p class="ops-usage-hint">这里只记次数、时长和存储，不收款。视频生成超过项目的成本上限时会拒绝新任务。</p>
    <el-form label-position="top" class="ops-entry-form" @submit.prevent="load">
      <div class="ops-entry-grid">
        <el-form-item label="项目编号"><el-input v-model="projectId" /></el-form-item>
      </div>
      <div class="ops-entry-actions">
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </el-form>
    <p>次数 {{ summary.call_count }} · 秒数 {{ summary.media_seconds }} · 存储 {{ summary.storage_bytes }}</p>
    <el-table :data="summary.events">
      <el-table-column prop="biz_app" label="业务" width="120" />
      <el-table-column prop="project_id" label="项目" width="120" />
      <el-table-column prop="model_profile" label="档位" />
      <el-table-column prop="call_count" label="次数" width="90" />
      <el-table-column prop="media_seconds" label="秒数" width="90" />
    </el-table>
    </section>
  </PageShell>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchUsage } from '../services/contentOpsService.js';

const projectId = ref('');
const summary = reactive({ call_count: 0, media_seconds: 0, storage_bytes: 0, events: [] });

async function load() {
  try {
    const data = await fetchUsage({ biz_app: 'video', project_id: projectId.value });
    summary.call_count = data.call_count || 0;
    summary.media_seconds = data.media_seconds || 0;
    summary.storage_bytes = data.storage_bytes || 0;
    summary.events = data.events || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
}
</script>

<style scoped>
.ops-usage-hint { margin-bottom: 12px; color: #5c6b63; }
</style>
