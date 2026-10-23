<template>
  <PageShell title="模型与路由">
    <p class="ops-model-hint">档位目录仍在 Agent。这里只控制停用。已经在队列里的任务可以跑完，新的启用会失败。</p>
    <el-alert v-if="!reachable" type="warning" title="Agent 目录暂时读不到" show-icon :closable="false" />
    <el-table :data="profiles">
      <el-table-column prop="label" label="档位" />
      <el-table-column prop="catalog" label="目录" width="100" />
      <el-table-column prop="provider" label="上游" width="140" />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="value => toggle(row, value)" />
        </template>
      </el-table-column>
    </el-table>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchModels, updateModel } from '../services/contentOpsService.js';

const reachable = ref(true);
const profiles = ref([]);
async function load() {
  const data = await fetchModels();
  reachable.value = data.reachable !== false;
  profiles.value = data.profiles || [];
}
async function toggle(row, enabled) {
  try {
    await updateModel(row.catalog, row.id, enabled);
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>

<style scoped>
.ops-model-hint { margin-bottom: 12px; color: #5c6b63; }
</style>
