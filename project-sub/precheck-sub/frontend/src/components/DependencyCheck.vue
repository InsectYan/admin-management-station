<template>
  <div>
    <el-button type="primary" :loading="loading" @click="check">依赖检测</el-button>
    <div v-if="message || diff" class="precheck-depend">
      <el-alert v-if="message" :title="message" :type="alertType" show-icon />
      <template v-if="diff">
        <p>缺失节点：{{ (diff.missing_nodes || []).join('、') || '无' }}</p>
        <p>缺失模型：{{ modelText }}</p>
        <p v-if="diff.low_vram">空闲显存 {{ diff.vram_free_gb }} GB，低于建议 {{ diff.suggested_vram_gb }} GB</p>
        <p v-if="diff.missing_models && diff.missing_models[0]">{{ diff.missing_models[0].advice }}</p>
        <SupplyBoard v-if="diff.supplies" :supplies="diff.supplies" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import SupplyBoard from './SupplyBoard.vue';

const props = defineProps({
  run: { type: Function, required: true },
});

const loading = ref(false);
const diff = ref(null);
const message = ref('');
const alertType = computed(() => {
  if (!diff.value) return 'error';
  if (!diff.value.online) return 'warning';
  return diff.value.ok ? 'success' : 'warning';
});
const modelText = computed(() => (diff.value?.missing_models || []).map(item => item.name).join('、') || '无');

async function check() {
  loading.value = true;
  try {
    diff.value = await props.run();
    if (!diff.value.online) message.value = diff.value.error || '运行时离线';
    else message.value = diff.value.ok ? '可用' : (diff.value.error || '有缺失项');
  } catch (err) {
    diff.value = null;
    message.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.precheck-depend { margin-top: 12px; }
.precheck-depend p { margin: 8px 0; }
</style>
