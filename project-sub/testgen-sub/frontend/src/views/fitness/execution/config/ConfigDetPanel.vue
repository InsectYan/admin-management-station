<template>
  <el-form label-width="120px">
    <el-form-item label="HTTP Method">
      <el-select
        v-if="!readonly"
        v-model="local.http_method"
        style="width: 140px"
        @change="sync"
      >
        <el-option label="GET" value="GET" />
        <el-option label="POST" value="POST" />
        <el-option label="PUT" value="PUT" />
        <el-option label="PATCH" value="PATCH" />
        <el-option label="DELETE" value="DELETE" />
      </el-select>
      <el-input v-else :model-value="displayMethod" disabled />
    </el-form-item>
    <el-form-item label="Path">
      <el-input v-model="local.endpoint_path" :disabled="readonly" @input="sync" />
    </el-form-item>
    <el-form-item label="期望 Status">
      <el-input-number v-model="local.http_status_expected" :disabled="readonly" @change="sync" />
      <p v-if="submitStatusHint" class="field-hint">{{ submitStatusHint }}</p>
    </el-form-item>
    <HttpBodyFormItems
      :method="local.http_method"
      :endpoint-path="local.endpoint_path"
      :model-value="bodyConfig"
      :readonly="readonly"
      @update:model-value="onBodyConfigUpdate"
    />
    <el-form-item label="断言点">
      <el-tag v-for="(a,i) in item.assertion_points||[]" :key="i" style="margin:2px">{{ a }}</el-tag>
    </el-form-item>
    <el-form-item label="CLI 命令">
      <el-input :model-value="item.automation_command" disabled />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import HttpBodyFormItems from '@/components/config-templates/HttpBodyFormItems.vue';
import { methodNeedsBody } from '@/utils/httpRequestBody.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits([ 'update:modelValue' ]);

const local = reactive({
  http_method: 'GET',
  endpoint_path: '',
  http_status_expected: 200,
});
const bodyConfig = ref({});
let applying = false;

const displayMethod = computed(() =>
  local.http_method || props.item?.http_method || props.modelValue?.http_method || 'GET',
);

const submitStatusHint = computed(() => {
  const path = local.endpoint_path || '';
  if (!path.includes('/turns/submit')) return '';
  return 'POST /turns/submit：首次入队期望 202；相同 client_turn_id 幂等重试期望 200。';
});

function snapshotConfig(src = {}) {
  return JSON.stringify({
    http_method: src.http_method || src.method || 'GET',
    endpoint_path: src.endpoint_path ?? '',
    http_status_expected: src.http_status_expected ?? 200,
    body: src.body,
    headers: src.headers,
    test_input_example: src.test_input_example,
  });
}

function applyModel(v) {
  if (applying) return;
  const src = v || {};
  const nextMethod = src.http_method || src.method || props.item?.http_method || 'GET';
  const nextPath = src.endpoint_path ?? props.item?.endpoint_path ?? '';
  const nextStatus = src.http_status_expected ?? props.item?.http_status_expected ?? 200;
  if (
    local.http_method === nextMethod
    && local.endpoint_path === nextPath
    && local.http_status_expected === nextStatus
    && snapshotConfig(bodyConfig.value) === snapshotConfig(src)
  ) {
    return;
  }
  applying = true;
  try {
    local.http_method = nextMethod;
    local.endpoint_path = nextPath;
    local.http_status_expected = nextStatus;
    bodyConfig.value = { ...src };
  } finally {
    applying = false;
  }
}

function buildPayload() {
  return {
    ...bodyConfig.value,
    http_method: local.http_method,
    endpoint_path: local.endpoint_path,
    http_status_expected: local.http_status_expected,
    method: local.http_method,
  };
}

function sync() {
  if (applying) return;
  const next = buildPayload();
  if (snapshotConfig(next) === snapshotConfig(props.modelValue)) return;
  emit('update:modelValue', next);
}

function onBodyConfigUpdate(v) {
  bodyConfig.value = v;
  sync();
}

watch(() => props.modelValue, applyModel, { deep: true, immediate: true });
watch(() => props.item?.item_id, () => applyModel(props.modelValue));
watch(() => local.http_method, (method) => {
  if (!methodNeedsBody(method)) sync();
});
</script>

<style scoped>
.field-hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  margin: 6px 0 0;
}
</style>
