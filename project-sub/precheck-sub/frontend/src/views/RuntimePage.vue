<template>
  <div>
    <h2 class="page-title">ComfyUI 运行时</h2>
    <el-card class="card-gap">
      <p v-if="!runtime">还没有运行时。</p>
      <template v-else>
        <p>{{ runtime.name }} · {{ runtime.base_url }} · 期望版本 {{ runtime.expected_version }}</p>
        <el-button type="primary" :loading="loading" @click="probe">重新探针</el-button>
      </template>
    </el-card>
    <el-alert v-if="error" :title="error" type="error" show-icon class="card-gap" />
    <el-descriptions v-if="report" :column="2" border>
      <el-descriptions-item label="在线">{{ report.online ? '是' : '否' }}</el-descriptions-item>
      <el-descriptions-item label="版本">{{ report.version || '—' }}（{{ report.version_ok ? '符合' : '不符合' }}）</el-descriptions-item>
      <el-descriptions-item label="显存">{{ vramText }}</el-descriptions-item>
      <el-descriptions-item label="节点数">{{ report.node_count }}</el-descriptions-item>
      <el-descriptions-item label="CheckpointLoaderSimple">{{ report.has_checkpoint_loader ? '有' : '无' }}</el-descriptions-item>
      <el-descriptions-item label="WanVideoModelLoader">{{ report.has_wan_video_loader ? '有（不应出现）' : '无' }}</el-descriptions-item>
    </el-descriptions>
    <el-card v-if="report?.checkpoint_names?.length" class="card-gap" style="margin-top: 16px">
      <template #header>checkpoint</template>
      <div v-for="name in report.checkpoint_names" :key="name">{{ name }}</div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { request } from '../services/apiConfig.js';

const runtime = ref(null);
const report = ref(null);
const error = ref('');
const loading = ref(false);

const vramText = computed(() => {
  const device = report.value?.devices?.[0];
  if (!device) return '—';
  const gb = (value) => (Number.isFinite(value) ? `${(value / 1024 ** 3).toFixed(1)} GB` : '—');
  return `${device.name || ''} 空闲 ${gb(device.vram_free)} / ${gb(device.vram_total)}`;
});

async function probe() {
  if (!runtime.value) return;
  loading.value = true;
  error.value = '';
  try {
    report.value = await request(`/runtimes/${runtime.value.id}/probe`);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const rows = await request('/runtimes');
  runtime.value = rows[0] || null;
  if (runtime.value) await probe();
});
</script>
