<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>
    <el-form-item label="判定">
      <el-input :model-value="item.validation_primary_id" disabled />
    </el-form-item>
    <el-divider content-position="left">链路步骤 (config_json.steps)</el-divider>
    <ChainStepTable :model-value="steps" @update:model-value="onStepsUpdate" />
    <p class="hint">支持 {{key}} 插值；extract 多组格式 var:$.path，换行分隔。</p>
  </el-form>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import ChainStepTable from './ChainStepTable.vue';
import { normalizeChainStep, serializeChainStep } from '@/utils/chainExtractUtils.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue' ]);

const steps = ref([]);
const chainVars = ref({});
let syncingFromInternal = false;

function sync() {
  syncingFromInternal = true;
  emit('update:modelValue', {
    execution_mode: 'chain',
    vars: chainVars.value,
    steps: steps.value.map(serializeChainStep),
  });
  queueMicrotask(() => {
    syncingFromInternal = false;
  });
}

function onStepsUpdate(val) {
  steps.value = val;
  sync();
}

function initFromProps() {
  if (syncingFromInternal) return;
  chainVars.value = { ...(props.modelValue?.vars || {}) };
  const raw = props.modelValue?.steps;
  if (Array.isArray(raw) && raw.length) {
    steps.value = raw.map(s => normalizeChainStep(s));
  } else if (!steps.value.length) {
    steps.value = [ normalizeChainStep({ path: '/health', method: 'GET', expect_status: 200 }) ];
  }
}

watch(() => props.modelValue, initFromProps, { deep: true });
onMounted(initFromProps);
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; margin-top: 12px; }
</style>
