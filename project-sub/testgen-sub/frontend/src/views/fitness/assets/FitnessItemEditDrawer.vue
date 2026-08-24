<template>
  <el-drawer
    :model-value="modelValue"
    title="编辑用例详情"
    size="640px"
    destroy-on-close
    :close-on-click-modal="false"
    @close="onCancel"
  >
    <el-form
      v-loading="booting"
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="130px"
      class="edit-drawer-form"
    >
      <el-divider content-position="left">只读信息</el-divider>
      <el-form-item label="用例 ID">
        <el-input :model-value="form.item_id" disabled />
      </el-form-item>
      <el-form-item label="项目">
        <el-input :model-value="projectDisplay" disabled />
      </el-form-item>
      <el-form-item label="测试大类">
        <el-input :model-value="majorDisplay" disabled />
      </el-form-item>
      <el-form-item label="来源">
        <el-input :model-value="sourceDisplay" disabled />
      </el-form-item>
      <el-form-item label="生成任务">
        <el-input :model-value="generationDisplay" disabled />
      </el-form-item>
      <el-form-item label="自动化状态">
        <el-input :model-value="automationStatusDisplay" disabled />
      </el-form-item>
      <el-form-item label="最新执行 ID">
        <el-input :model-value="latestRunDisplay" disabled />
      </el-form-item>

      <el-divider content-position="left">基本信息</el-divider>
      <el-form-item label="用例名称" prop="item_name">
        <el-input v-model="form.item_name" maxlength="512" show-word-limit />
      </el-form-item>
      <el-form-item label="测试小类" prop="category_minor_id">
        <el-select v-model="form.category_minor_id" filterable style="width: 100%">
          <el-option
            v-for="m in filteredMinors"
            :key="m.category_minor_id"
            :label="`${m.category_minor_id} · ${m.name || ''}`"
            :value="m.category_minor_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级" prop="priority_id">
        <el-select v-model="form.priority_id" style="width: 160px">
          <el-option
            v-for="p in priorityOptions"
            :key="p.priority_id"
            :label="p.name || p.priority_id"
            :value="p.priority_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="六站">
        <el-select v-model="form.station_id" clearable filterable style="width: 100%">
          <el-option
            v-for="s in stationOptions"
            :key="s.station_id"
            :label="`${s.station_id} · ${s.name || ''}`"
            :value="s.station_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="业务角色">
        <el-select v-model="form.role_scope_id" clearable filterable style="width: 100%">
          <el-option
            v-for="r in roleOptions"
            :key="r.role_scope_id"
            :label="`${r.role_scope_id} · ${r.name || ''}`"
            :value="r.role_scope_id"
          />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">执行方案（TS）与判定（VS）</el-divider>
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px">
        变更主执行方案将联动配置模板与默认配置；运行时 HTTP body / 断言请到
        <router-link :to="configRoute">配置页</router-link>
        调整。
      </el-alert>
      <el-form-item label="执行方案（TS）" prop="scheme_primary_id">
        <el-select
          v-model="form.scheme_primary_id"
          filterable
          style="width: 100%"
          @change="onPrimarySchemeChange"
        >
          <el-option
            v-for="s in schemeOptions"
            :key="s.scheme_id"
            :label="formatSchemeLabel(s.scheme_id, s.name)"
            :value="s.scheme_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="判定方式（VS）" prop="validation_primary_id">
        <el-select v-model="form.validation_primary_id" filterable style="width: 100%">
          <el-option
            v-for="v in primaryValidationOptions"
            :key="v.validation_id"
            :label="`${formatValidationLabel(v.validation_id, v.name)}${v.is_primary ? ' (方案默认)' : ''}`"
            :value="v.validation_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="配置模板">
        <el-select
          v-if="primaryTemplateOptions.length > 1"
          v-model="form.template_code"
          style="width: 100%"
        >
          <el-option
            v-for="code in primaryTemplateOptions"
            :key="code"
            :label="`${code} · ${TEMPLATE_DISPLAY_NAMES[code] || code}`"
            :value="code"
          />
        </el-select>
        <el-input
          v-else
          :model-value="`${form.template_code || defaultTemplateForScheme(form.scheme_primary_id)} · ${TEMPLATE_DISPLAY_NAMES[form.template_code || defaultTemplateForScheme(form.scheme_primary_id)] || '—'}`"
          disabled
        />
      </el-form-item>
      <el-form-item label="配置初始化">
        <el-checkbox v-model="form.migrate_config">
          按新执行方案自动初始化配置模板（推荐）
        </el-checkbox>
      </el-form-item>
      <el-form-item label="辅执行方案">
        <el-select
          v-model="form.scheme_secondary_id"
          clearable
          filterable
          placeholder="可选"
          style="width: 100%"
          @change="onSecondarySchemeChange"
        >
          <el-option
            v-for="s in schemeOptions"
            :key="s.scheme_id"
            :label="formatSchemeLabel(s.scheme_id, s.name)"
            :value="s.scheme_id"
            :disabled="s.scheme_id === form.scheme_primary_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="辅判定方式">
        <el-select
          v-model="form.validation_secondary_id"
          clearable
          filterable
          :disabled="!form.scheme_secondary_id"
          style="width: 100%"
        >
          <el-option
            v-for="v in secondaryValidationOptions"
            :key="v.validation_id"
            :label="formatValidationLabel(v.validation_id, v.name)"
            :value="v.validation_id"
          />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">测什么</el-divider>
      <el-form-item label="测什么" prop="detail_summary">
        <el-input v-model="form.detail_summary" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="期望结果" prop="expected_observation">
        <el-input v-model="form.expected_observation" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="输入示例">
        <el-input v-model="form.test_input_example" type="textarea" :rows="2" />
      </el-form-item>

      <el-divider content-position="left">怎么执行</el-divider>
      <el-form-item label="前置条件">
        <el-input v-model="form.preconditions_text" type="textarea" :rows="3" placeholder="每行一条" />
      </el-form-item>
      <el-form-item label="测试步骤" prop="test_steps_text">
        <el-input v-model="form.test_steps_text" type="textarea" :rows="4" placeholder="每行一步" />
      </el-form-item>
      <el-form-item label="断言点">
        <el-input v-model="form.assertion_points_text" type="textarea" :rows="3" placeholder="每行一条" />
      </el-form-item>
      <el-form-item label="执行说明">
        <el-input v-model="form.sample_execution_note" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="自动化命令">
        <el-input v-model="form.automation_command" type="textarea" :rows="2" placeholder="CLI 模式命令，可选" />
      </el-form-item>

      <el-divider content-position="left">HTTP 元数据（表字段）</el-divider>
      <el-form-item label="端点路径">
        <el-input v-model="form.endpoint_path" placeholder="/api/..." />
      </el-form-item>
      <el-form-item label="HTTP 方法">
        <el-select v-model="form.http_method" clearable style="width: 160px">
          <el-option v-for="m in HTTP_METHODS" :key="m" :label="m" :value="m" />
        </el-select>
      </el-form-item>
      <el-form-item label="期望状态码">
        <el-input-number v-model="form.http_status_expected" :min="100" :max="599" controls-position="right" />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.notes" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="form.tags_text" type="textarea" :rows="2" placeholder="每行一个标签" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="onCancel">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onConfirm">确认</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  MIXED_TS_MAJORS,
  SCHEME_TEMPLATE_ALTERNATIVES,
  SCHEME_TO_TEMPLATE,
  TEMPLATE_DISPLAY_NAMES,
  API_CTX_SCHEME,
  CHAIN_SCHEME,
  resolveMixedEffectiveTemplate,
} from '@/components/config-templates/registry.js';
import {
  fetchEnums,
  fetchSchemeValidations,
  fetchSchemes,
  updateTestItem,
} from '@/services/fitnessService.js';
import { buildItemDetailRoute } from '@/utils/itemListQuery.js';
import {
  formatCategoryDisplay,
  formatSchemeLabel,
  formatValidationLabel,
} from '@/utils/testCategoryDisplay.js';

const HTTP_METHODS = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ];

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  item: { type: Object, default: null },
});

const emit = defineEmits([ 'update:modelValue', 'saved' ]);

const route = useRoute();
const formRef = ref(null);
const booting = ref(false);
const saving = ref(false);
const schemeOptions = ref([]);
const priorityOptions = ref([]);
const stationOptions = ref([]);
const roleOptions = ref([]);
const minorOptions = ref([]);
const primaryValidationOptions = ref([]);
const secondaryValidationOptions = ref([]);

const form = reactive({
  item_id: '',
  project_code: '',
  project_name: '',
  category_major_id: '',
  category_major_name: '',
  category_minor_id: '',
  source_doc: '',
  source_section: '',
  generation_job_id: null,
  generation_task_name: '',
  automation_status_id: '',
  automation_status_name: '',
  latest_ft_run_id: null,
  item_name: '',
  priority_id: 'P2',
  station_id: '',
  role_scope_id: '',
  scheme_primary_id: '',
  validation_primary_id: '',
  template_code: '',
  migrate_config: true,
  scheme_secondary_id: '',
  validation_secondary_id: '',
  detail_summary: '',
  expected_observation: '',
  test_input_example: '',
  preconditions_text: '',
  test_steps_text: '',
  assertion_points_text: '',
  sample_execution_note: '',
  automation_command: '',
  endpoint_path: '',
  http_method: '',
  http_status_expected: null,
  notes: '',
  tags_text: '',
});

const rules = {
  item_name: [{ required: true, message: '请输入用例名称', trigger: 'blur' }],
  category_minor_id: [{ required: true, message: '请选择测试小类', trigger: 'change' }],
  priority_id: [{ required: true, message: '请选择优先级', trigger: 'change' }],
  scheme_primary_id: [{ required: true, message: '请选择执行方案', trigger: 'change' }],
  validation_primary_id: [{ required: true, message: '请选择判定方式', trigger: 'change' }],
  detail_summary: [{ required: true, message: '请输入测什么', trigger: 'blur' }],
  expected_observation: [{ required: true, message: '请输入期望结果', trigger: 'blur' }],
  test_steps_text: [{ required: true, message: '请输入测试步骤', trigger: 'blur' }],
};

const isMixedTs = computed(() => MIXED_TS_MAJORS.has(form.category_major_id));

const filteredMinors = computed(() =>
  minorOptions.value.filter(m => m.category_major_id === form.category_major_id),
);

const configRoute = computed(() =>
  buildItemDetailRoute(form.item_id || route.params.itemId, { module: 'config', query: route.query }),
);

const projectDisplay = computed(() => form.project_name || form.project_code || '—');
const majorDisplay = computed(() =>
  formatCategoryDisplay(form.category_major_id, form.category_major_name) || '—',
);
const sourceDisplay = computed(() =>
  [ form.source_doc, form.source_section ].filter(Boolean).join(' ') || '—',
);
const generationDisplay = computed(() => {
  if (!form.generation_job_id) return '—';
  return form.generation_task_name
    ? `#${form.generation_job_id} · ${form.generation_task_name}`
    : `#${form.generation_job_id}`;
});
const automationStatusDisplay = computed(() =>
  form.automation_status_name || form.automation_status_id || '—',
);
const latestRunDisplay = computed(() =>
  form.latest_ft_run_id != null ? `#${form.latest_ft_run_id}` : '—',
);

function defaultTemplateForScheme(schemeId) {
  if (isMixedTs.value && schemeId === CHAIN_SCHEME) return 'TPL-API-CTX';
  return SCHEME_TO_TEMPLATE[schemeId] || 'TPL-DET';
}

const primaryTemplateOptions = computed(() => {
  const schemeId = form.scheme_primary_id;
  if (!schemeId) return [];
  const alts = SCHEME_TEMPLATE_ALTERNATIVES[schemeId];
  if (alts?.length) return alts;
  return [ defaultTemplateForScheme(schemeId) ];
});

function linesToArray(text) {
  return String(text || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

function fillFromItem(row) {
  if (!row) return;
  form.item_id = row.item_id || '';
  form.project_code = row.project_code || '';
  form.project_name = row.project_name || '';
  form.category_major_id = row.category_major_id || '';
  form.category_major_name = row.category_major_name || '';
  form.category_minor_id = row.category_minor_id || '';
  form.source_doc = row.source_doc || '';
  form.source_section = row.source_section || '';
  form.generation_job_id = row.generation_job_id || null;
  form.generation_task_name = row.generation_task_name || '';
  form.automation_status_id = row.automation_status_id || '';
  form.automation_status_name = row.automation_status_name || '';
  form.latest_ft_run_id = row.latest_ft_run_id ?? null;
  form.item_name = row.item_name || '';
  form.priority_id = row.priority_id || 'P2';
  form.station_id = row.station_id || '';
  form.role_scope_id = row.role_scope_id || '';
  form.scheme_primary_id = row.scheme_primary_id || '';
  form.validation_primary_id = row.validation_primary_id || '';
  form.template_code = row.template_code
    || resolveMixedEffectiveTemplate(row)
    || defaultTemplateForScheme(row.scheme_primary_id);
  form.migrate_config = true;
  form.scheme_secondary_id = row.scheme_secondary_id || '';
  form.validation_secondary_id = row.validation_secondary_id || '';
  form.detail_summary = row.detail_summary || '';
  form.expected_observation = row.expected_observation || '';
  form.test_input_example = row.test_input_example || '';
  form.preconditions_text = arrayToLines(row.preconditions);
  form.test_steps_text = arrayToLines(row.test_steps);
  form.assertion_points_text = arrayToLines(row.assertion_points);
  form.sample_execution_note = row.sample_execution_note || '';
  form.automation_command = row.automation_command || '';
  form.endpoint_path = row.endpoint_path || '';
  form.http_method = row.http_method || '';
  form.http_status_expected = row.http_status_expected ?? null;
  form.notes = row.notes || '';
  form.tags_text = arrayToLines(row.tags);
}

async function loadPrimaryValidations(schemeId) {
  if (!schemeId) {
    primaryValidationOptions.value = [];
    return;
  }
  primaryValidationOptions.value = await fetchSchemeValidations(schemeId);
}

async function loadSecondaryValidations(schemeId) {
  if (!schemeId) {
    secondaryValidationOptions.value = [];
    return;
  }
  secondaryValidationOptions.value = await fetchSchemeValidations(schemeId);
}

async function onPrimarySchemeChange(schemeId) {
  await loadPrimaryValidations(schemeId);
  form.template_code = defaultTemplateForScheme(schemeId);
  if (!primaryValidationOptions.value.some(v => v.validation_id === form.validation_primary_id)) {
    const primary = primaryValidationOptions.value.find(v => v.is_primary);
    form.validation_primary_id = primary?.validation_id
      || primaryValidationOptions.value[0]?.validation_id
      || '';
  }
}

async function onSecondarySchemeChange(schemeId) {
  if (!schemeId) {
    form.validation_secondary_id = '';
    secondaryValidationOptions.value = [];
    return;
  }
  await loadSecondaryValidations(schemeId);
  if (!secondaryValidationOptions.value.some(v => v.validation_id === form.validation_secondary_id)) {
    const primary = secondaryValidationOptions.value.find(v => v.is_primary);
    form.validation_secondary_id = primary?.validation_id
      || secondaryValidationOptions.value[0]?.validation_id
      || '';
  }
}

async function bootOptions() {
  booting.value = true;
  try {
    const pageSize = 200;
    const [ schemes, priRes, stationRes, roleRes, minorRes ] = await Promise.all([
      fetchSchemes({ pageSize: 100 }),
      fetchEnums('test_priority_enum', { page: 1, pageSize: 20 }),
      fetchEnums('test_station_enum', { page: 1, pageSize }),
      fetchEnums('test_role_enum', { page: 1, pageSize }),
      fetchEnums('test_category_minor', { page: 1, pageSize: 500 }),
    ]);
    schemeOptions.value = schemes.schemes || schemes.list || [];
    priorityOptions.value = priRes.list || [];
    stationOptions.value = stationRes.list || [];
    roleOptions.value = roleRes.list || [];
    minorOptions.value = minorRes.list || [];
    if (form.scheme_primary_id) await loadPrimaryValidations(form.scheme_primary_id);
    if (form.scheme_secondary_id) await loadSecondaryValidations(form.scheme_secondary_id);
  } catch {
    ElMessage.warning('加载枚举失败，请关闭后重试');
  } finally {
    booting.value = false;
  }
}

function onCancel() {
  emit('update:modelValue', false);
}

async function onConfirm() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const payload = {
      item_name: form.item_name.trim(),
      category_minor_id: form.category_minor_id,
      priority_id: form.priority_id,
      scheme_primary_id: form.scheme_primary_id,
      validation_primary_id: form.validation_primary_id,
      template_code: primaryTemplateOptions.value.length > 1
        ? form.template_code
        : (form.template_code || undefined),
      migrate_config: form.migrate_config,
      scheme_secondary_id: form.scheme_secondary_id || null,
      validation_secondary_id: form.scheme_secondary_id
        ? (form.validation_secondary_id || null)
        : null,
      detail_summary: form.detail_summary.trim(),
      expected_observation: form.expected_observation.trim(),
      test_input_example: form.test_input_example?.trim() || null,
      preconditions: linesToArray(form.preconditions_text),
      test_steps: linesToArray(form.test_steps_text),
      assertion_points: linesToArray(form.assertion_points_text),
      sample_execution_note: form.sample_execution_note?.trim() || null,
      automation_command: form.automation_command?.trim() || null,
      endpoint_path: form.endpoint_path?.trim() || null,
      http_method: form.http_method || null,
      http_status_expected: form.http_status_expected ?? null,
      notes: form.notes?.trim() || null,
      tags: linesToArray(form.tags_text),
    };
    // station / role 列为 NOT NULL，空值不提交以免写成 null
    if (form.station_id) payload.station_id = form.station_id;
    if (form.role_scope_id) payload.role_scope_id = form.role_scope_id;

    const data = await updateTestItem(form.item_id, payload);
    ElMessage.success(data.scheme_migration?.hint || '用例详情已保存');
    emit('saved', data);
    emit('update:modelValue', false);
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.modelValue,
  async open => {
    if (!open) return;
    fillFromItem(props.item);
    await bootOptions();
    formRef.value?.clearValidate();
  },
);
</script>

<style scoped>
.edit-drawer-form {
  padding-right: 8px;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
