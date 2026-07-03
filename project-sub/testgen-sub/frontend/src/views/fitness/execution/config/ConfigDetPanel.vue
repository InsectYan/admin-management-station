<template>
  <el-form label-width="120px">
    <el-form-item v-if="!readonly" label="关联接口模板">
      <el-switch v-model="local.use_api_template" @change="onToggleApiTemplate" />
      <span class="field-hint" style="margin-left:8px">启用后使用接口模板渲染请求，可配置注入字段</span>
    </el-form-item>

    <template v-if="local.use_api_template">
      <el-form-item label="接口模板">
        <el-select
          v-model="local.api_template_id"
          :disabled="readonly"
          filterable
          placeholder="选择接口模板"
          style="width:100%;max-width:480px"
          @change="onTemplateChange"
        >
          <el-option
            v-for="t in apiTemplates"
            :key="t.id"
            :label="`${t.name} · ${t.http_method} ${t.url_path}`"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
      <ApiInjectBindingsForm
        v-if="injectFields.length"
        :fields="injectFields"
        :api-template-id="local.api_template_id"
        v-model="local.inject_bindings"
        :readonly="readonly"
        @update:model-value="sync"
      />
      <el-alert v-else-if="local.api_template_id" type="info" :closable="false">
        该模板未定义可注入字段，将使用 Body 模板原样发送。
      </el-alert>
    </template>

    <template v-else>
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
    </template>

    <el-form-item v-if="local.use_api_template" label="期望 Status">
      <el-input-number v-model="local.http_status_expected" :disabled="readonly" @change="sync" />
    </el-form-item>

    <el-form-item label="断言点">
      <el-tag v-for="(a,i) in item.assertion_points||[]" :key="i" style="margin:2px">{{ a }}</el-tag>
    </el-form-item>
    <el-form-item label="CLI 命令">
      <el-input :model-value="item.automation_command" disabled />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import HttpBodyFormItems from '@/components/config-templates/HttpBodyFormItems.vue';
import ApiInjectBindingsForm from '@/components/config-templates/ApiInjectBindingsForm.vue';
import { fetchApiTemplate, fetchApiTemplates } from '@/services/fitnessService.js';
import { methodNeedsBody } from '@/utils/httpRequestBody.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits([ 'update:modelValue' ]);

const local = reactive({
  use_api_template: false,
  api_template_id: null,
  inject_bindings: {},
  http_method: 'GET',
  endpoint_path: '',
  http_status_expected: 200,
});
const bodyConfig = ref({});
const apiTemplates = ref([]);
const injectFields = ref([]);
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
    use_api_template: src.use_api_template,
    api_template_id: src.api_template_id,
    inject_bindings: src.inject_bindings,
    http_method: src.http_method || src.method || 'GET',
    endpoint_path: src.endpoint_path ?? '',
    http_status_expected: src.http_status_expected ?? 200,
    body: src.body,
    headers: src.headers,
    test_input_example: src.test_input_example,
  });
}

async function loadApiTemplates() {
  const data = await fetchApiTemplates({ pageSize: 100 });
  apiTemplates.value = data.list || [];
}

async function loadInjectFields(templateId) {
  if (!templateId) {
    injectFields.value = [];
    return;
  }
  try {
    const tpl = await fetchApiTemplate(templateId);
    injectFields.value = Array.isArray(tpl.inject_schema) ? tpl.inject_schema : [];
  } catch {
    injectFields.value = [];
  }
}

function applyModel(v) {
  if (applying) return;
  const src = v || {};
  applying = true;
  try {
    local.use_api_template = Boolean(src.use_api_template);
    local.api_template_id = src.api_template_id ?? null;
    local.inject_bindings = { ...(src.inject_bindings || {}) };
    local.http_method = src.http_method || src.method || props.item?.http_method || 'GET';
    local.endpoint_path = src.endpoint_path ?? props.item?.endpoint_path ?? '';
    local.http_status_expected = src.http_status_expected ?? props.item?.http_status_expected ?? 200;
    bodyConfig.value = { ...src };
    if (local.api_template_id) loadInjectFields(local.api_template_id);
  } finally {
    applying = false;
  }
}

function buildPayload() {
  if (local.use_api_template) {
    return {
      ...bodyConfig.value,
      use_api_template: true,
      api_template_id: local.api_template_id,
      inject_bindings: local.inject_bindings,
      http_status_expected: local.http_status_expected,
    };
  }
  return {
    ...bodyConfig.value,
    use_api_template: false,
    api_template_id: null,
    inject_bindings: {},
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

async function onTemplateChange(id) {
  await loadInjectFields(id);
  local.inject_bindings = {};
  sync();
}

function onToggleApiTemplate() {
  if (!local.use_api_template) {
    local.api_template_id = null;
    local.inject_bindings = {};
    injectFields.value = [];
  }
  sync();
}

watch(() => props.modelValue, applyModel, { deep: true, immediate: true });
watch(() => props.item?.item_id, () => applyModel(props.modelValue));
watch(() => local.http_method, (method) => {
  if (!methodNeedsBody(method)) sync();
});

onMounted(loadApiTemplates);
</script>

<style scoped>
.field-hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  margin: 6px 0 0;
}
</style>
