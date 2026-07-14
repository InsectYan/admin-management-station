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
          执行 <code>preflight_steps</code>；若主请求 Path 含 <code v-pre>{{turn_id}}</code> 等变量且前置未提取，将<strong>自动执行模板主请求</strong>（如 submit）获取变量
        </p>
      </el-form-item>

      <el-form-item v-if="local.preflight_api_template_id" label="前置选项">
        <el-checkbox v-model="local.preflight_include_main_request" :disabled="readonly" @change="sync">
          执行模板主请求（submit 等）以获取 turn_id
        </el-checkbox>
        <p class="field-hint">poll 类用例（Path 为 /api/chat/turns/{{turn_id}}）必须开启；仅 bootstrap 无法得到 turn_id</p>
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

        <el-alert v-if="pathPlaceholderWarning" type="warning" :closable="false" show-icon style="margin-bottom:12px">
          {{ pathPlaceholderWarning }}
        </el-alert>

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
      <HttpBodyFormItems
        :method="local.http_method"
        :endpoint-path="local.endpoint_path"
        :model-value="bodyConfig"
        :readonly="readonly"
        @update:model-value="onBodyConfigUpdate"
      />

      <el-divider content-position="left">响应断言</el-divider>
      <el-form-item label="Body 字段断言">
        <el-table :data="local.assertions" size="small" border style="width:100%;max-width:720px">
          <el-table-column label="JSONPath" min-width="160">
            <template #default="{ row }">
              <el-input
                v-model="row.path"
                size="small"
                :disabled="readonly || row.type === 'status'"
                placeholder="$.code"
                @change="sync"
              />
            </template>
          </el-table-column>
          <el-table-column label="期望值" min-width="180">
            <template #default="{ row }">
              <el-input
                v-if="!row.exists"
                v-model="row.expect"
                size="small"
                :disabled="readonly"
                placeholder="TURN_SESSION_INFLIGHT"
                @change="sync"
              />
              <el-tag v-else size="small" type="info">仅要求字段存在</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70">
            <template #default="{ $index, row }">
              <el-button
                v-if="row.type !== 'status'"
                link
                type="danger"
                :disabled="readonly"
                @click="removeAssertion($index)"
              >删</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!readonly" style="margin-top:8px">
          <el-button size="small" @click="addAssertion">添加字段断言</el-button>
          <el-button size="small" @click="addExistsAssertion">添加「字段存在」</el-button>
          <el-button size="small" type="primary" link @click="applyDerivedAssertions">
            从期望观测 / 断言点解析
          </el-button>
        </div>
        <p class="field-hint">
          例：<code>$.code</code> = <code>TURN_SESSION_INFLIGHT</code>。
          也可写在用例「期望观测」里如 <code>429 + code=TURN_SESSION_INFLIGHT</code>，执行时自动解析。
        </p>
      </el-form-item>
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
  preflight_include_main_request: true,
  http_method: 'GET',
  endpoint_path: '',
  http_status_expected: 200,
  assertions: [],
});
const bodyConfig = ref({});
const apiTemplates = ref([]);
const selectedPreflight = ref(null);
let applying = false;
let bodySyncing = false;

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

function collectPathPlaceholders(text) {
  const keys = [];
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(String(text || '')))) keys.push(m[1]);
  return keys;
}

const pathPlaceholderWarning = computed(() => {
  if (!local.preflight_api_template_id) return '';
  const needed = collectPathPlaceholders(local.endpoint_path);
  if (!needed.length) return '';
  const available = new Set(exportFields.value.map(f => f.key));
  available.add('session_id');
  available.add('uuid');
  const missing = needed.filter(k => !available.has(k));
  if (!missing.length) return '';
  const mainHint = /\/turns\/submit/i.test(selectedPreflight.value?.url_path || '')
    ? '请勾选「执行模板主请求」或在 preflight 增加 submit 步骤。'
    : '请在前置链路 extract 或 export_schema 中配置对应字段。';
  return `主请求 Path 需要 ${missing.map(k => varPlaceholder(k)).join('、')}，当前前置模板可能无法提供。${mainHint}`;
});

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
    preflight_include_main_request: src.preflight_include_main_request,
    http_method: src.http_method || src.method || 'GET',
    endpoint_path: src.endpoint_path ?? '',
    http_status_expected: src.http_status_expected ?? 200,
    body: src.body,
    headers: src.headers,
    test_input_example: src.test_input_example,
    assertions: src.assertions,
  });
}

function normalizeAssertionRows(list = []) {
  return (list || [])
    .filter(a => a && a.type !== 'status')
    .map(a => ({
      type: a.type || 'json_path',
      path: a.path || a.json_path || (a.field ? `$.${a.field}` : '$.code'),
      expect: a.expect != null ? String(a.expect) : '',
      exists: Boolean(a.exists),
    }));
}

function parseAssertHintsFromText(...texts) {
  const rules = [];
  const flat = texts.flat().filter(Boolean).map(String).join('\n');
  const codeRe = /\bcode\s*[=:：]\s*['"]?([A-Z][A-Z0-9_]+)['"]?/gi;
  let m;
  while ((m = codeRe.exec(flat))) {
    rules.push({ type: 'json_path', path: '$.code', expect: m[1], exists: false });
  }
  if (/\bretry_after_sec\b/i.test(flat) && !rules.some(r => r.path === '$.retry_after_sec')) {
    rules.push({ type: 'json_path', path: '$.retry_after_sec', expect: '', exists: true });
  }
  return rules;
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
  if (applying || bodySyncing) return;
  const src = v || {};
  applying = true;
  try {
    local.execution_mode = src.execution_mode || (props.item?.automation_command ? 'cli' : 'http');
    local.preflight_api_template_id = src.preflight_api_template_id
      ?? (src.use_api_template ? src.api_template_id : null)
      ?? null;
    local.preflight_input_params = { ...(src.preflight_input_params || {}) };
    local.preflight_include_main_request = src.preflight_include_main_request !== false;
    local.http_method = src.http_method || src.method || props.item?.http_method || 'GET';
    local.endpoint_path = src.endpoint_path ?? props.item?.endpoint_path ?? '';
    local.http_status_expected = src.http_status_expected ?? props.item?.http_status_expected ?? 200;
    local.assertions = normalizeAssertionRows(src.assertions);
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
  const fieldAssertions = (local.assertions || [])
    .filter(a => a.path)
    .map(a => {
      if (a.exists) return { type: 'json_path', path: a.path, exists: true };
      return { type: 'json_path', path: a.path, expect: a.expect };
    });
  return {
    ...bodyConfig.value,
    execution_mode: executionMode.value,
    preflight_api_template_id: local.preflight_api_template_id || null,
    preflight_input_params: { ...local.preflight_input_params },
    preflight_include_main_request: local.preflight_include_main_request,
    use_api_template: false,
    api_template_id: null,
    inject_bindings: {},
    http_method: local.http_method,
    endpoint_path: local.endpoint_path,
    http_status_expected: local.http_status_expected,
    method: local.http_method,
    assertions: fieldAssertions,
  };
}

function sync() {
  if (applying) return;
  const next = buildPayload();
  if (snapshotConfig(next) === snapshotConfig(props.modelValue)) return;
  emit('update:modelValue', next);
}

function onBodyConfigUpdate(v) {
  bodySyncing = true;
  bodyConfig.value = v;
  sync();
  queueMicrotask(() => {
    bodySyncing = false;
  });
}

function addAssertion() {
  local.assertions.push({ type: 'json_path', path: '$.code', expect: '', exists: false });
  sync();
}

function addExistsAssertion() {
  local.assertions.push({ type: 'json_path', path: '$.retry_after_sec', expect: '', exists: true });
  sync();
}

function removeAssertion(i) {
  local.assertions.splice(i, 1);
  sync();
}

function applyDerivedAssertions() {
  const derived = parseAssertHintsFromText(
    props.item?.expected_observation,
    props.item?.assertion_points,
  );
  if (!derived.length) {
    local.assertions.push({ type: 'json_path', path: '$.code', expect: '', exists: false });
  } else {
    for (const r of derived) {
      if (!local.assertions.some(a => a.path === r.path && String(a.expect) === String(r.expect))) {
        local.assertions.push(r);
      }
    }
  }
  sync();
}

async function onPreflightTemplateChange(id) {
  local.preflight_input_params = {};
  await loadPreflightDetail(id);
  if (collectPathPlaceholders(local.endpoint_path).includes('turn_id')) {
    local.preflight_include_main_request = true;
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
.tpl-summary { font-size: 13px; line-height: 1.6; }
.tpl-summary .meta { color: #909399; font-size: 12px; }
.param-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.param-label { width: 120px; flex-shrink: 0; color: #606266; font-size: 13px; }
.export-list { margin: 4px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
.usage-hint { color: #909399; }
</style>
