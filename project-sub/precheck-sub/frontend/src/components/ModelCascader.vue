<template>
  <div class="precheck-model-cascader">
    <el-cascader
      :model-value="modelValue || undefined"
      :options="options"
      :props="cascaderProps"
      :disabled="loading && !options.length"
      :placeholder="placeholderText"
      filterable
      :filter-method="filterMethod"
      :teleported="false"
      separator=" / "
      style="width: 100%"
      @change="onChange"
    />
    <el-button link type="primary" :loading="loading" @click="reload">刷新</el-button>
    <p v-if="hint" class="precheck-model-cascader__hint">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { loadModelFolder, modelFolderState } from '../lib/modelCatalog.js';

const props = defineProps({
  folder: { type: String, required: true },
  modelValue: { type: String, default: '' },
});
const emit = defineEmits([ 'update:modelValue' ]);

const cascaderProps = { emitPath: false, expandTrigger: 'click' };
const entry = computed(() => modelFolderState(props.folder));
const loading = computed(() => entry.value.loading);

const options = computed(() => {
  const tree = entry.value.tree || [];
  const names = new Set(entry.value.names || []);
  const current = props.modelValue;
  if (!current || names.has(current)) return tree;
  return [ { label: `${current}（当前，Comfy 未列出）`, value: current }, ...tree ];
});

const placeholderText = computed(() => (loading.value ? '正在读取 ComfyUI 模型' : '选择模型文件'));

const hint = computed(() => {
  if (!entry.value.loaded) return '';
  if (!entry.value.online) return entry.value.error || 'ComfyUI 未连接，仍显示当前模型';
  if (!entry.value.names.length) return '这个目录下 ComfyUI 没有读到模型';
  return '';
});

function selectedLabel() {
  const current = props.modelValue;
  if (!current) return '';
  const names = new Set(entry.value.names || []);
  if (!names.has(current)) return `${current}（当前，Comfy 未列出）`;
  return current.split(/[/\\]/).join(' / ');
}

function filterMethod(node, keyword) {
  const query = String(keyword || '').trim().toLowerCase();
  const selected = selectedLabel().trim().toLowerCase();
  if (!query || query === selected) return true;
  const text = `${node.text || ''} ${node.label || ''}`.toLowerCase();
  return text.includes(query);
}

function onChange(value) {
  if (typeof value !== 'string' || !value || value === props.modelValue) return;
  emit('update:modelValue', value);
}

function reload() {
  loadModelFolder(props.folder, true);
}

watch(() => props.folder, folder => {
  if (folder) loadModelFolder(folder);
}, { immediate: true });

onMounted(() => {
  if (props.folder) loadModelFolder(props.folder);
});
</script>

<style scoped>
.precheck-model-cascader { position: relative; z-index: 2; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.precheck-model-cascader:focus-within { z-index: 30; }
.precheck-model-cascader :deep(.el-cascader) { flex: 1 1 240px; }
.precheck-model-cascader__hint { flex: 1 0 100%; margin: 0; color: #8a5a12; font-size: 12px; }
</style>
