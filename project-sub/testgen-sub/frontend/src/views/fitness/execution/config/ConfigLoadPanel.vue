<template>
  <el-form label-width="140px">
    <el-form-item label="虚拟用户 (VU)">
      <el-input-number v-model="local.vu" :min="1" :max="10000" @change="sync" />
    </el-form-item>
    <el-form-item label="持续时间 (秒)">
      <el-input-number v-model="local.duration_sec" :min="1" :max="86400" @change="sync" />
    </el-form-item>
    <el-form-item label="Path">
      <el-input v-model="local.path" placeholder="/api/health" @input="sync" />
    </el-form-item>
    <el-form-item label="Method">
      <el-select v-model="local.method" style="width:120px" @change="sync">
        <el-option label="GET" value="GET" />
        <el-option label="POST" value="POST" />
        <el-option label="PUT" value="PUT" />
      </el-select>
    </el-form-item>
    <el-divider content-position="left">SLO 阈值</el-divider>
    <el-form-item label="P99 上限 (ms)">
      <el-input-number v-model="thresholdLocal.p99_max_ms" :min="1" @change="syncThreshold" />
    </el-form-item>
    <el-form-item label="错误率上限 (%)">
      <el-input-number v-model="thresholdLocal.error_rate_max" :min="0" :max="100" :precision="2" @change="syncThreshold" />
    </el-form-item>
    <p class="hint">TS-09-LOAD 压测参数；VS-10 按 p99 与错误率判定。</p>
  </el-form>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  threshold: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue', 'update:threshold' ]);

const local = reactive({
  vu: props.modelValue?.vu ?? 10,
  duration_sec: props.modelValue?.duration_sec ?? 60,
  path: props.modelValue?.path ?? props.item?.endpoint_path ?? '/health',
  method: props.modelValue?.method ?? props.item?.http_method ?? 'GET',
});
const thresholdLocal = reactive({
  p99_max_ms: props.threshold?.p99_max_ms ?? 500,
  error_rate_max: props.threshold?.error_rate_max ?? 1,
});

function sync() {
  emit('update:modelValue', { ...local });
}

function syncThreshold() {
  emit('update:threshold', { ...thresholdLocal });
}

watch(() => props.modelValue, (v) => Object.assign(local, {
  vu: v?.vu ?? 10,
  duration_sec: v?.duration_sec ?? 60,
  path: v?.path ?? props.item?.endpoint_path ?? '/health',
  method: v?.method ?? props.item?.http_method ?? 'GET',
}), { deep: true });

watch(() => props.threshold, (v) => Object.assign(thresholdLocal, {
  p99_max_ms: v?.p99_max_ms ?? 500,
  error_rate_max: v?.error_rate_max ?? 1,
}), { deep: true });
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; }
</style>
