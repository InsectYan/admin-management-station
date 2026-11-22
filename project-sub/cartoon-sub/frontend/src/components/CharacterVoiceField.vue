<template>
  <div class="cartoon-voice-pick">
    <el-select
      :model-value="modelValue"
      filterable
      clearable
      placeholder="从音色库选择"
      style="width: 100%"
      @update:model-value="value => emit('update:modelValue', value || '')"
    >
      <el-option
        v-for="item in rows"
        :key="item.voice_key"
        :label="labelOf(item)"
        :value="item.voice_key"
      />
    </el-select>
    <el-button :disabled="!current" @click="preview">试听</el-button>
  </div>
  <audio ref="audio" class="cartoon-voice-player" controls></audio>
  <p class="cartoon-module__hint">生成视频时，工作流里有音色入口就会写入这条音色。</p>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
});
const emit = defineEmits([ 'update:modelValue' ]);

const rows = ref([]);
const audio = ref(null);
const current = computed(() => rows.value.find(item => item.voice_key === props.modelValue) || null);

function labelOf(item) {
  return item.folder ? `${item.folder} / ${item.name}` : item.name;
}

function preview() {
  const row = current.value;
  const player = audio.value;
  if (!row || !player) return;
  player.src = `${resolveApiBase()}/voice-library/file?id=${encodeURIComponent(row.id)}`;
  player.play().catch(() => {});
}

onMounted(async () => {
  try {
    const data = await request('/voice-library');
    rows.value = data?.rows || [];
  } catch (err) {
    rows.value = [];
    ElMessage.error(err.message || '音色库没有打开');
  }
});
</script>

<style scoped>
.cartoon-voice-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.cartoon-voice-player { width: 100%; margin-top: 8px; }
</style>
