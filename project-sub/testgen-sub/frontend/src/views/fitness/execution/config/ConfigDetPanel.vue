<template>
  <el-form label-width="120px">
    <el-alert
      v-if="executionMode === 'cli'"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom:12px"
    >
      本用例为 <strong>CLI 执行</strong> 模式，将直接运行下方命令，无需配置 HTTP 请求。
    </el-alert>

    <el-form-item v-else label="执行模式">
      <el-tag type="success">接口测试</el-tag>
      <span class="field-hint" style="margin-left:8px">配置主请求；可选关联前置接口模板获取 session_id 等入参</span>
    </el-form-item>

    <template v-if="executionMode === 'http'">
      <el-divider content-position="left">前置接口模板（可选）</el-divider>
      <el-form-item label="关联模板">
        <el-select
          v-model="local.preflight_api_template_id"
          :disabled="readonly"
          clearable
          filterable
          placeholder="选择带前置链路的接口模板"
          style="width:100%;max-width:480px"
          @change="onPreflightTemplateChange"
        >
          <el-option
            v-for="t in apiTemplates"
            :key="t.id"
            :label="`${t.name} · 前置 ${(t.preflight_steps || []).length} 步`"
            :value="t.id"
          />
        </el-select>
        <p class="field-hint">
          仅执行模板中的 <code>preflight_steps</code>，成功后变量写入池供下方主请求 <code v-pre>{{key}}</code> 插值使用
        </p>
      </el-form-item>

      <template v-if="local.preflight_api_template_id && selectedPreflight">
        <el-form-item label="模板摘要">
          <div class="tpl-summary">
            <div>{{ selectedPreflight.name }}</div>
            <div class="meta">
              前置 {{ (selectedPreflight.preflight_steps || []).length }} 步 ·
              可抛出 {{ exportFields.length }} 项
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="preflightInputFields.length" label="前置入参">
          <div v-for="p in preflightInputFields" :key="p.key" class="param-row">
            <span class="param-label">{{ p.label || p.key }}</span>
            <el-input
              v-model="local.preflight_input_params[p.key]"
              size="small"
              :disabled="readonly"
              :placeholder="p.default != null ? String(p.default) : ''"
              @input="sync"
            />
          </div>
        </el-form-item>

        <el-alert v-if="exportFields.length" type="success" :closable="false" style="margin-bottom:12px">
          <template #title>可抛出字段 · 主请求入参用法</template>
          <ul class="export-list">
            <li v-for="f in exportFields" :key="f.key">
              <code>{{ f.key }}</code>
              <span v-if="f.label">（{{ f.label }}）</span>
              — 在 Path / Body / Headers 中使用 <code>{{ varPlaceholder(f.key) }}</code>
              <span v-if="f.usage_hint" class="usage-hint">· {{ f.usage_hint }}</span>
            </li>
          </ul>
          <p class="field-hint" style="margin-top:8px">
            示例：Body 写 <code v-pre>{"session_id":"{{session_id}}","turn_id":"{{turn_id}}"}</code>，
            前置成功后自动替换为实际值
          </p>
        </el-alert>
      </template>

      <el-divider content-position="left">主接口请求配置</el-divider>
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
        <el-input v-model="local.endpoint_path" :disabled="readonly" placeholder="/api/..." @input="sync" />
      </el-form-item>
      <el-form-item label="期望 Status">
        <el-input-number v-model="local.http_status_expected" :disabled="readonly" @change="sync" />
        <p v-if="submitStatusHint" class="field-hint">{{ submitStatusHint }}</p>
      </el-form-item>
      <el-form-item label="请求头">
        <el-input
          v-model="headersText"
          type="textarea"
          :rows="2"
          :disabled="readonly"
          placeholder='{"Authorization":"Bearer {{token}}"}'
          @blur="parseHeaders"
        />
        <p class="field-hint">JSON 对象；合并环境全局请求头；支持 <code v-pre>{{key}}</code> 插值</p>
      </el-form-item>
      <HttpBodyFormItems
        :method="local.http_method"
        :endpoint-path="local.endpoint_path"
        :model-value="bodyConfig"
        :readonly="readonly"
        @update:model-value="onBodyConfigUpdate"
      />
    </template>

    <el-divider content-position="left">用例元数据</el-divider>
    <el-form-item label="断言点">
      <el-tag v-for="(a,i) in item.assertion_points||[]" :key="i" style="margin:2px">{{ a }}</el-tag>
      <span v-if="!(item.assertion_points||[]).length" class="field-hint">—</span>
    </el-form-item>
    <el-form-item label="CLI 命令">
      <el-input :model-value="item.automation_command" disabled />
      <p v-if="item.automation_command" class="field-hint">存在 CLI 命令时优先走 CLI 执行，上方 HTTP 配置作为备用参考</p>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import HttpBodyFormItems from '@/components/config-templates/HttpBodyFormItems.vue';
import { fetchApiTemplate, fetchApiTemplates } from '@/services/fitnessService.js';
import { methodNeedsBody } from '@/utils/httpRequestBody.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits([ 'update:modelValue' ]);

const local = reactive({
  execution_mode: 'http',
  preflight_api_template_id: null,
  preflight_input_params: {},
  http_method: 'GET',
  endpoint_path: '',
  http_status_expected: 200,
  headers: {},
});
const bodyConfig = ref({});
const headersText = ref('{}');
const apiTemplates = ref([]);
const selectedPreflight = ref(null);
let applying = false;

const executionMode = computed(() =>
  (props.item?.automation_command ? 'cli' : local.execution_mode) || 'http',
);

const displayMethod = computed(() =>
  local.http_method || props.item?.http_method || props.modelValue?.http_method || 'GET',
);

const submitStatusHint = computed(() => {
  const path = local.endpoint_path || '';
  if (!path.includes('/turns/submit')) return '';
  return 'POST /turns/submit：首次入队期望 202；相同 client_turn_id 幂等重试期望 200。';
});

function varPlaceholder(key) {
  return `{{${key}}}`;
}

const preflightInputFields = computed(() =>
  selectedPreflight.value?.input_params_schema || [],
);

const exportFields = computed(() => {
  const schema = selectedPreflight.value?.export_schema || [];
  if (schema.length) return schema;
  const steps = selectedPreflight.value?.preflight_steps || [];
  const fields = [];
  for (const step of steps) {
    if (!step.extract) continue;
    for (const [ key, path ] of Object.entries(step.extract)) {
      fields.push({
        key,
        label: key,
        json_path: path,
        source: 'preflight',
        usage_hint: `前置步骤 extract: ${path}`,
      });
    }
  }
  return fields;
});

function snapshotConfig(src = {}) {
  return JSON.stringify({
    execution_mode: src.execution_mode,
    preflight_api_template_id: src.preflight_api_template_id,
    preflight_input_params: src.preflight_input_params,
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
  apiTemplates.value = (data.list || []).filter(t => (t.preflight_steps || []).length > 0 || t.export_schema?.length);
}

async function loadPreflightDetail(id) {
  if (!id) {
    selectedPreflight.value = null;
    return;
  }
  try {
    selectedPreflight.value = await fetchApiTemplate(id);
    for (const p of selectedPreflight.value.input_params_schema || []) {
      if (local.preflight_input_params[p.key] == null && p.default !== undefined) {
        local.preflight_input_params[p.key] = p.default;
      }
    }
  } catch {
    selectedPreflight.value = null;
  }
}

function applyModel(v) {
  if (applying) return;
  const src = v || {};
  applying = true;
  try {
    local.execution_mode = src.execution_mode || (props.item?.automation_command ? 'cli' : 'http');
    local.preflight_api_template_id = src.preflight_api_template_id
      ?? (src.use_api_template ? src.api_template_id : null)
      ?? null;
    local.preflight_input_params = { ...(src.preflight_input_params || {}) };
    local.http_method = src.http_method || src.method || props.item?.http_method || 'GET';
    local.endpoint_path = src.endpoint_path ?? props.item?.endpoint_path ?? '';
    local.http_status_expected = src.http_status_expected ?? props.item?.http_status_expected ?? 200;
    local.headers = { ...(src.headers || {}) };
    headersText.value = JSON.stringify(local.headers, null, 2);
    bodyConfig.value = { ...src };
    if (local.preflight_api_template_id) {
      loadPreflightDetail(local.preflight_api_template_id);
    } else {
      selectedPreflight.value = null;
    }
  } finally {
    applying = false;
  }
}

function buildPayload() {
  return {
    ...bodyConfig.value,
    execution_mode: executionMode.value,
    preflight_api_template_id: local.preflight_api_template_id || null,
    preflight_input_params: { ...local.preflight_input_params },
    use_api_template: false,
    api_template_id: null,
    inject_bindings: {},
    http_method: local.http_method,
    endpoint_path: local.endpoint_path,
    http_status_expected: local.http_status_expected,
    method: local.http_method,
    headers: local.headers,
  };
}

function sync() {
  if (applying) return;
  const next = buildPayload();
  if (snapshotConfig(next) === snapshotConfig(props.modelValue)) return;
  emit('update:modelValue', next);
}

function parseHeaders() {
  try {
    local.headers = JSON.parse(headersText.value || '{}');
    sync();
  } catch {
    // 保留编辑态，等用户修正
  }
}

function onBodyConfigUpdate(v) {
  bodyConfig.value = v;
  sync();
}

async function onPreflightTemplateChange(id) {
  local.preflight_input_params = {};
  await loadPreflightDetail(id);
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
.tpl-summary { font-size: 13px; line-height: 1.6; }
.tpl-summary .meta { color: #909399; font-size: 12px; }
.param-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.param-label { width: 120px; flex-shrink: 0; color: #606266; font-size: 13px; }
.export-list { margin: 4px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
.usage-hint { color: #909399; }
</style>
