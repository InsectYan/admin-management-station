<template>
  <PageShell title="ComfyUI 运行时">
    <div class="precheck-module">
      <h3 class="precheck-module__title">连接</h3>
      <p v-if="!runtime">还没有运行时。</p>
      <template v-else>
        <p>{{ runtime.name }} · {{ runtime.base_url }} · 期望版本 {{ runtime.expected_version }}</p>
        <div class="precheck-runtime__actions">
          <el-button type="primary" :loading="loading" @click="probe">重新探针</el-button>
          <el-button :loading="starting" @click="startComfy">启动 ComfyUI</el-button>
        </div>
      </template>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon class="precheck-module" />
    <div v-if="report" class="precheck-module">
      <h3 class="precheck-module__title">探针结果</h3>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="在线">
          <el-tag :type="report.online ? 'success' : 'danger'">{{ report.online ? '是' : '否' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="版本">
          {{ report.version || '—' }}
          <el-tag :type="report.version_ok ? 'success' : 'warning'">{{ report.version_ok ? '符合' : '不符合' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="显存">{{ vramText }}</el-descriptions-item>
        <el-descriptions-item label="节点数">{{ report.node_count }}</el-descriptions-item>
        <el-descriptions-item label="CheckpointLoaderSimple">
          <el-tag :type="report.has_checkpoint_loader ? 'success' : 'danger'">{{ report.has_checkpoint_loader ? '有' : '无' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="WanVideoModelLoader">
          <el-tag :type="report.has_wan_video_loader ? 'warning' : 'success'">{{ report.has_wan_video_loader ? '有（不应出现）' : '无' }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <div v-if="report?.checkpoint_names?.length" class="precheck-module">
      <h3 class="precheck-module__title">checkpoint</h3>
      <div v-for="name in report.checkpoint_names" :key="name">{{ name }}</div>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';

const runtime = ref(null);
const report = ref(null);
const error = ref('');
const loading = ref(false);
const starting = ref(false);

const vramText = computed(() => {
  const device = report.value?.devices?.[0];
  if (!device) return '—';
  const gb = (value) => (Number.isFinite(value) ? `${(value / 1024 ** 3).toFixed(1)} GB` : '—');
  return `${device.name || ''} 空闲 ${gb(device.vram_free)} / ${gb(device.vram_total)}`;
});

async function loadProbe() {
  report.value = await request(`/runtimes/${runtime.value.id}/probe`);
}

async function probe() {
  if (!runtime.value) return;
  loading.value = true;
  error.value = '';
  try {
    await loadProbe();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function startComfy() {
  if (!runtime.value || starting.value) return;
  starting.value = true;
  error.value = '';
  try {
    const result = await request(`/runtimes/${runtime.value.id}/start`, { method: 'POST' });
    ElMessage.success(result?.message || '已执行启动指令');
    if (result?.already_running) {
      await loadProbe();
      return;
    }
    for (let i = 0; i < 15; i += 1) {
      await wait(3000);
      try {
        await loadProbe();
      } catch (err) {
        error.value = err.message;
      }
      if (report.value?.online) {
        ElMessage.success('ComfyUI 已在线');
        return;
      }
    }
    ElMessage.info('启动指令已执行，ComfyUI 仍在加载，可稍后重新探针');
  } catch (err) {
    error.value = err.message;
  } finally {
    starting.value = false;
  }
}

onMounted(async () => {
  const rows = await request('/runtimes');
  runtime.value = rows[0] || null;
  if (runtime.value) await probe();
});
</script>

<style scoped>
.precheck-runtime__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
