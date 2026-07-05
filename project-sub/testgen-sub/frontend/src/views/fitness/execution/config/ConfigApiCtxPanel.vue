<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>

    <el-form-item label="接口模板" required>
      <el-select
        v-model="apiTemplateId"
        filterable
        placeholder="选择已配置的接口模板"
        style="width:100%"
        @change="onTemplateChange"
      >
        <el-option
          v-for="t in apiTemplates"
          :key="t.id"
          :label="`${t.name} (${t.template_code})`"
          :value="t.id"
        />
      </el-select>
      <p class="hint-inline">
        前置链路、Body 模板、Poll/Forbidden 均在
        <router-link to="/config/api-templates">接口模板管理</router-link>
        中维护
      </p>
    </el-form-item>

    <el-form-item v-if="selectedTemplate" label="模板摘要">
      <div class="tpl-summary">
        <div>{{ selectedTemplate.http_method }} {{ selectedTemplate.url_path }}</div>
        <div class="meta">
          前置 {{ (selectedTemplate.preflight_steps || []).length }} 步 ·
          入参 {{ (selectedTemplate.input_params_schema || []).length }} 项 ·
          注入 {{ (selectedTemplate.inject_schema || []).length }} 字段
        </div>
      </div>
    </el-form-item>

    <el-form-item v-if="inputParamFields.length" label="外部入参">
      <div class="param-toolbar">
        <el-button size="small" @click="triggerParamImport">导入 JSON</el-button>
        <input ref="paramImportRef" type="file" accept=".json,application/json" style="display:none" @change="onParamImport" />
      </div>
      <div v-for="p in inputParamFields" :key="p.key" class="param-row">
        <span class="param-label">
          {{ p.label || p.key }}
          <el-tag size="small" type="info" class="bind-tag">{{ bindLabel(p.bind_to) }}</el-tag>
        </span>
        <el-input
          v-model="inputParams[p.key]"
          size="small"
          :placeholder="p.default != null ? String(p.default) : ''"
          @input="sync"
        />
      </div>
      <p class="hint-inline">
        按模板 bind_to 统一写入 query/body/path/header；context 型供 <code v-pre>{{key}}</code> 与前置链路
      </p>
    </el-form-item>

    <ApiInjectBindingsForm
      v-if="apiTemplateId && injectFields.length"
      :fields="injectFields"
      v-model="injectBindings"
      :item-id="item.item_id"
      @update:model-value="sync"
    />

    <el-divider content-position="left">验证方案（TS-05-CHAIN 全部可关联）</el-divider>
    <el-form-item label="主验证">
      <el-select v-model="validationPrimaryId" style="width:100%" @change="emitValidations">
        <el-option
          v-for="v in validationOptions"
          :key="v.validation_id"
          :label="`${v.validation_id} · ${v.name}${v.is_primary ? ' (默认)' : ''}`"
          :value="v.validation_id"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="辅验证">
      <el-select
        v-model="validationSecondaryId"
        clearable
        style="width:100%"
        @change="emitValidations"
      >
        <el-option
          v-for="v in validationOptions"
          :key="'s-' + v.validation_id"
          :label="`${v.validation_id} · ${v.name}`"
          :value="v.validation_id"
        />
      </el-select>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import ApiInjectBindingsForm from '@/components/config-templates/ApiInjectBindingsForm.vue';
import {
  fetchApiTemplate,
  fetchApiTemplates,
  fetchSchemeValidations,
} from '@/services/fitnessService.js';
import { bindToLabel, parseInputParamsImportJson } from '@/utils/apiTemplateParamBind.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue', 'update:validations' ]);

const apiTemplates = ref([]);
const apiTemplateId = ref(null);
const selectedTemplate = ref(null);
const injectBindings = ref({});
const inputParams = ref({});
const validationOptions = ref([]);
const validationPrimaryId = ref('');
const validationSecondaryId = ref('');
const paramImportRef = ref(null);

const injectFields = computed(() => selectedTemplate.value?.inject_schema || []);
const inputParamFields = computed(() => selectedTemplate.value?.input_params_schema || []);

function bindLabel(bindTo) {
  return bindToLabel(bindTo);
}

function triggerParamImport() {
  paramImportRef.value?.click();
}

async function onParamImport(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const imported = parseInputParamsImportJson(await file.text());
    inputParams.value = { ...inputParams.value, ...imported };
    sync();
    ElMessage.success('已导入外部入参');
  } catch (e) {
    ElMessage.error(e.message || '导入失败');
  }
}

let syncingFromInternal = false;
let loadedTemplateId = null;
let loadingTemplateId = null;

function sync() {
  syncingFromInternal = true;
  emit('update:modelValue', {
    execution_mode: 'api_ctx',
    api_template_id: apiTemplateId.value,
    use_api_template: true,
    input_params: { ...inputParams.value },
    inject_bindings: { ...injectBindings.value },
  });
  queueMicrotask(() => {
    syncingFromInternal = false;
  });
}

function emitValidations() {
  emit('update:validations', {
    validation_primary_id: validationPrimaryId.value || null,
    validation_secondary_id: validationSecondaryId.value || null,
  });
}

async function loadValidations() {
  validationOptions.value = await fetchSchemeValidations(props.item.scheme_primary_id || 'TS-05-CHAIN');
}

async function loadTemplateDetail(id) {
  if (!id) {
    selectedTemplate.value = null;
    loadedTemplateId = null;
    return;
  }
  if (loadedTemplateId === id && selectedTemplate.value) return;
  if (loadingTemplateId === id) return;
  loadingTemplateId = id;
  try {
    selectedTemplate.value = await fetchApiTemplate(id);
    loadedTemplateId = id;
    for (const p of selectedTemplate.value.input_params_schema || []) {
      if (inputParams.value[p.key] == null && p.default !== undefined) {
        inputParams.value[p.key] = p.default;
      }
    }
  } finally {
    if (loadingTemplateId === id) loadingTemplateId = null;
  }
}

async function onTemplateChange(id) {
  apiTemplateId.value = id || null;
  await loadTemplateDetail(id);
  sync();
}

async function loadTemplates() {
  const data = await fetchApiTemplates({ pageSize: 100, project_code: 'fitness-agent' });
  apiTemplates.value = data.list || [];
}

function initFromProps() {
  if (syncingFromInternal) return;
  const cfg = props.modelValue || {};
  const nextId = cfg.api_template_id ?? null;
  apiTemplateId.value = nextId;
  injectBindings.value = { ...(cfg.inject_bindings || {}) };
  inputParams.value = { ...(cfg.input_params || {}) };
  validationPrimaryId.value = props.item.validation_primary_id || '';
  validationSecondaryId.value = props.item.validation_secondary_id || '';
  emitValidations();
  if (nextId !== loadedTemplateId) {
    loadTemplateDetail(nextId);
  }
}

watch(() => props.modelValue, initFromProps, { deep: true });
watch(() => props.item?.validation_primary_id, () => {
  validationPrimaryId.value = props.item?.validation_primary_id || validationPrimaryId.value;
  validationSecondaryId.value = props.item?.validation_secondary_id || '';
  emitValidations();
});

onMounted(async () => {
  await Promise.all([ loadTemplates(), loadValidations() ]);
  initFromProps();
});
</script>

<style scoped>
.hint-inline { color: #909399; font-size: 12px; margin-top: 4px; }
.hint-inline a { color: var(--el-color-primary); }
.tpl-summary { font-size: 13px; line-height: 1.6; }
.tpl-summary .meta { color: #909399; font-size: 12px; }
.param-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.param-label { width: 140px; flex-shrink: 0; color: #606266; font-size: 13px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.bind-tag { margin-left: 2px; }
.param-toolbar { margin-bottom: 8px; }
.param-row .el-input { flex: 1; }
</style>
