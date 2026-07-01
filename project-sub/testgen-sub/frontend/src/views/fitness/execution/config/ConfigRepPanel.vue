<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>
    <el-form-item label="判定">
      <el-input :model-value="item.validation_primary_id" disabled />
    </el-form-item>
    <el-divider content-position="left">重复抽样 (TS-03-REP)</el-divider>
    <el-form-item label="重复次数 N">
      <el-input-number v-model="local.repeat_count" :min="1" :max="100" @change="sync" />
    </el-form-item>
    <el-form-item label="passk_M">
      <el-input-number v-model="thresholdLocal.passk_M" :min="1" :max="100" @change="syncThreshold" />
      <span class="hint-inline">至少通过 M 次（VS-08-PASSK）</span>
    </el-form-item>
    <el-form-item label="passk_N">
      <el-input-number v-model="thresholdLocal.passk_N" :min="1" :max="100" @change="syncThreshold" />
    </el-form-item>
    <el-divider content-position="left">单次请求配置</el-divider>
    <el-form-item label="Runner">
      <el-radio-group v-model="local.runner" @change="sync">
        <el-radio value="http">HTTP</el-radio>
        <el-radio value="cli">CLI</el-radio>
      </el-radio-group>
    </el-form-item>
    <template v-if="local.runner === 'http'">
      <el-form-item label="Path">
        <el-input v-model="local.path" placeholder="/health" @input="sync" />
      </el-form-item>
      <el-form-item label="Method">
        <el-select v-model="local.method" style="width:120px" @change="sync">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="PATCH" value="PATCH" />
        </el-select>
      </el-form-item>
      <el-form-item label="期望 Status">
        <el-input-number v-model="local.expect_status" :min="100" :max="599" @change="sync" />
      </el-form-item>
      <HttpBodyFormItems
        :method="local.method"
        :endpoint-path="local.path"
        v-model="bodyConfig"
      />
    </template>
    <template v-else>
      <el-form-item label="CLI 命令">
        <el-input
          v-model="local.command"
          type="textarea"
          :rows="2"
          placeholder="留空则用 item.automation_command"
          @input="sync"
        />
      </el-form-item>
      <el-form-item label="默认命令">
        <el-input :model-value="item.automation_command" disabled />
      </el-form-item>
    </template>
    <p class="hint">同一配置重复 N 次；Pass^k 判定 pass 次数 ≥ passk_M。</p>
  </el-form>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import HttpBodyFormItems from '@/components/config-templates/HttpBodyFormItems.vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  threshold: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue', 'update:threshold' ]);

const local = reactive({
  repeat_count: 3,
  runner: 'http',
  path: '/health',
  method: 'GET',
  expect_status: 200,
  command: '',
});

const thresholdLocal = reactive({
  passk_N: 3,
  passk_M: 3,
});

const bodyConfig = ref({});

function sync() {
  emit('update:modelValue', {
    repeat_count: local.repeat_count,
    runner: local.runner,
    path: local.path,
    method: local.method,
    expect_status: local.expect_status,
    command: local.command || undefined,
    ...bodyConfig.value,
  });
}

function syncThreshold() {
  if (thresholdLocal.passk_N == null) thresholdLocal.passk_N = local.repeat_count;
  emit('update:threshold', { ...thresholdLocal });
}

function initFromProps() {
  Object.assign(local, {
    repeat_count: props.modelValue?.repeat_count ?? 3,
    runner: props.modelValue?.runner || (props.item?.automation_command ? 'cli' : 'http'),
    path: props.modelValue?.path || props.item?.endpoint_path || '/health',
    method: props.modelValue?.method || props.item?.http_method || 'GET',
    expect_status: props.modelValue?.expect_status ?? props.item?.http_status_expected ?? 200,
    command: props.modelValue?.command || '',
  });
  Object.assign(thresholdLocal, {
    passk_N: props.threshold?.passk_N ?? local.repeat_count,
    passk_M: props.threshold?.passk_M ?? local.repeat_count,
  });
  bodyConfig.value = { ...props.modelValue };
}

watch(bodyConfig, () => sync(), { deep: true });

watch(() => props.modelValue, initFromProps, { deep: true });
watch(() => props.threshold, v => Object.assign(thresholdLocal, v || {}), { deep: true });
watch(() => local.repeat_count, n => {
  if (!props.threshold?.passk_N) thresholdLocal.passk_N = n;
  syncThreshold();
});

onMounted(() => {
  initFromProps();
  sync();
  syncThreshold();
});
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; margin-top: 8px; }
.hint-inline { margin-left: 8px; color: #909399; font-size: 12px; }
</style>
