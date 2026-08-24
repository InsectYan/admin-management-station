<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="120px"
    class="manual-item-form"
  >
    <el-divider content-position="left">基本信息</el-divider>

    <el-form-item label="项目" prop="project_code">
      <el-select
        v-model="form.project_code"
        filterable
        placeholder="选择项目"
        style="width: 100%"
        @change="onProjectChange"
      >
        <el-option
          v-for="p in projectOptions"
          :key="p.project_code"
          :label="p.project_name"
          :value="p.project_code"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="用例 ID">
      <el-input
        v-model="form.item_id"
        placeholder="留空自动生成，如 C1-MANUAL-001"
        maxlength="64"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="测试分类" prop="category_major_id">
      <CategoryMajorCascader
        v-model="form.category_major_id"
        :majors="majorOptions"
        placeholder="选择测试分类"
        width="100%"
        @change="onMajorChange"
      />
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
        <el-option v-for="p in priorityOptions" :key="p.priority_id" :label="p.priority_id" :value="p.priority_id" />
      </el-select>
    </el-form-item>

    <el-divider content-position="left">方案与验证</el-divider>

    <el-form-item label="执行方案（TS）" prop="scheme_primary_id">
      <el-select v-model="form.scheme_primary_id" filterable style="width: 100%" @change="onSchemeChange">
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
          v-for="v in schemeValidationOptions"
          :key="v.validation_id"
          :label="`${formatValidationLabel(v.validation_id, v.name)}${v.is_primary ? ' (默认)' : ''}`"
          :value="v.validation_id"
        />
      </el-select>
    </el-form-item>

    <el-form-item v-if="showTemplatePicker" label="配置模板">
      <el-select v-model="form.template_code" clearable placeholder="默认按方案解析" style="width: 100%">
        <el-option
          v-for="code in templateOptions"
          :key="code"
          :label="`${code} · ${TEMPLATE_DISPLAY_NAMES[code] || code}`"
          :value="code"
        />
      </el-select>
      <p v-if="majorProfile?.is_mixed" class="hint">混合执行方案的测试分类可指定 TPL-API-CTX 等变体</p>
    </el-form-item>

    <el-divider content-position="left">用例内容</el-divider>

    <el-form-item label="用例名称" prop="item_name">
      <el-input v-model="form.item_name" maxlength="512" show-word-limit placeholder="简短标题" />
    </el-form-item>

    <el-form-item label="测什么" prop="detail_summary">
      <el-input v-model="form.detail_summary" type="textarea" :rows="2" placeholder="测试意图摘要" />
    </el-form-item>

    <el-form-item label="期望结果" prop="expected_observation">
      <el-input v-model="form.expected_observation" type="textarea" :rows="2" placeholder="通过时应观测到什么" />
    </el-form-item>

    <el-form-item label="测试步骤" prop="test_steps_text">
      <el-input
        v-model="form.test_steps_text"
        type="textarea"
        :rows="4"
        placeholder="每行一步"
      />
    </el-form-item>

    <el-form-item label="前置条件">
      <el-input v-model="form.preconditions_text" type="textarea" :rows="2" placeholder="每行一条，可选" />
    </el-form-item>

    <el-form-item label="断言点">
      <el-input v-model="form.assertion_points_text" type="textarea" :rows="2" placeholder="每行一条，可选" />
    </el-form-item>

    <el-form-item label="输入示例">
      <el-input v-model="form.test_input_example" type="textarea" :rows="2" placeholder="可选" />
    </el-form-item>

    <el-divider content-position="left">HTTP（可选）</el-divider>

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

    <el-form-item>
      <el-button type="primary" :loading="submitting" @click="submit">生成用例</el-button>
      <el-button @click="resetForm">重置</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  MIXED_TS_MAJORS,
  SCHEME_TEMPLATE_ALTERNATIVES,
  TEMPLATE_DISPLAY_NAMES,
  API_CTX_SCHEME,
  CHAIN_SCHEME,
} from '@/components/config-templates/registry.js';
import CategoryMajorCascader from '@/components/fitness/CategoryMajorCascader.vue';
import {
  createManualTestItem,
  fetchEnums,
  fetchMajorTemplateMapping,
  fetchSchemeValidations,
  fetchSchemes,
} from '@/services/fitnessService.js';
import { fetchProjects } from '@/services/projectService.js';
import { formatSchemeLabel, formatValidationLabel } from '@/utils/testCategoryDisplay.js';

const HTTP_METHODS = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ];

const router = useRouter();
const formRef = ref(null);
const submitting = ref(false);
const projectOptions = ref([]);
const majorOptions = ref([]);
const minorOptions = ref([]);
const schemeOptions = ref([]);
const priorityOptions = ref([]);
const schemeValidationOptions = ref([]);
const majorProfile = ref(null);

const defaultForm = () => ({
  project_code: '',
  item_id: '',
  category_major_id: '',
  category_minor_id: '',
  priority_id: 'P2',
  scheme_primary_id: '',
  validation_primary_id: '',
  template_code: '',
  item_name: '',
  detail_summary: '',
  expected_observation: '',
  test_steps_text: '',
  preconditions_text: '',
  assertion_points_text: '',
  test_input_example: '',
  endpoint_path: '',
  http_method: '',
  http_status_expected: null,
  notes: '',
});

const form = ref(defaultForm());

const rules = {
  project_code: [{ required: true, message: '请选择项目', trigger: 'change' }],
  category_major_id: [{ required: true, message: '请选择测试分类', trigger: 'change' }],
  category_minor_id: [{ required: true, message: '请选择测试小类', trigger: 'change' }],
  priority_id: [{ required: true, message: '请选择优先级', trigger: 'change' }],
  scheme_primary_id: [{ required: true, message: '请选择执行方案', trigger: 'change' }],
  validation_primary_id: [{ required: true, message: '请选择判定方式', trigger: 'change' }],
  item_name: [{ required: true, message: '请输入用例名称', trigger: 'blur' }],
  detail_summary: [{ required: true, message: '请输入测什么', trigger: 'blur' }],
  expected_observation: [{ required: true, message: '请输入期望结果', trigger: 'blur' }],
  test_steps_text: [{ required: true, message: '请输入测试步骤', trigger: 'blur' }],
};

const filteredMinors = computed(() =>
  minorOptions.value.filter(m => m.category_major_id === form.value.category_major_id),
);

const showTemplatePicker = computed(() =>
  Boolean(form.value.scheme_primary_id)
  && (majorProfile.value?.is_mixed
    || form.value.scheme_primary_id === CHAIN_SCHEME
    || form.value.scheme_primary_id === API_CTX_SCHEME),
);

const templateOptions = computed(() => {
  if (form.value.scheme_primary_id === CHAIN_SCHEME || form.value.scheme_primary_id === API_CTX_SCHEME) {
    return SCHEME_TEMPLATE_ALTERNATIVES[form.value.scheme_primary_id]
      || SCHEME_TEMPLATE_ALTERNATIVES[API_CTX_SCHEME];
  }
  if (majorProfile.value?.is_mixed) {
    return [ 'TPL-API-CTX' ];
  }
  return [];
});

function linesToArray(text) {
  return String(text || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function onProjectChange() {
  // project_name resolved on submit
}

async function onMajorChange(majorId) {
  form.value.category_minor_id = '';
  form.value.template_code = '';
  majorProfile.value = null;
  if (!majorId) return;

  const minors = filteredMinors.value;
  if (minors.length) {
    form.value.category_minor_id = minors[0].category_minor_id;
  }

  try {
    majorProfile.value = await fetchMajorTemplateMapping(majorId);
    if (!form.value.scheme_primary_id) {
      form.value.scheme_primary_id = majorProfile.value?.scheme_id
        || majorOptions.value.find(m => m.category_major_id === majorId)?.default_scheme_id
        || '';
    }
    if (form.value.scheme_primary_id) {
      await onSchemeChange(form.value.scheme_primary_id);
    }
  } catch {
    majorProfile.value = { is_mixed: MIXED_TS_MAJORS.has(majorId) };
  }
}

async function onSchemeChange(schemeId) {
  form.value.validation_primary_id = '';
  form.value.template_code = '';
  if (!schemeId) {
    schemeValidationOptions.value = [];
    return;
  }
  schemeValidationOptions.value = await fetchSchemeValidations(schemeId);
  const primary = schemeValidationOptions.value.find(v => v.is_primary);
  form.value.validation_primary_id = primary?.validation_id
    || schemeValidationOptions.value[0]?.validation_id
    || '';
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const project = projectOptions.value.find(p => p.project_code === form.value.project_code);
    const payload = {
      project_code: form.value.project_code,
      project_name: project?.project_name || form.value.project_code,
      item_id: form.value.item_id?.trim() || undefined,
      category_major_id: form.value.category_major_id,
      category_minor_id: form.value.category_minor_id,
      priority_id: form.value.priority_id,
      scheme_primary_id: form.value.scheme_primary_id,
      validation_primary_id: form.value.validation_primary_id,
      template_code: form.value.template_code || undefined,
      item_name: form.value.item_name.trim(),
      detail_summary: form.value.detail_summary.trim(),
      expected_observation: form.value.expected_observation.trim(),
      test_steps: linesToArray(form.value.test_steps_text),
      preconditions: linesToArray(form.value.preconditions_text),
      assertion_points: linesToArray(form.value.assertion_points_text),
      test_input_example: form.value.test_input_example?.trim() || undefined,
      endpoint_path: form.value.endpoint_path?.trim() || undefined,
      http_method: form.value.http_method || undefined,
      http_status_expected: form.value.http_status_expected ?? undefined,
      notes: form.value.notes?.trim() || undefined,
    };

    const item = await createManualTestItem(payload);
    ElMessage.success(`用例 ${item.item_id} 已生成`);
    router.push({ name: 'fitness-item-detail', params: { itemId: item.item_id } });
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '生成失败');
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.value = defaultForm();
  schemeValidationOptions.value = [];
  majorProfile.value = null;
  formRef.value?.clearValidate();
}

watch(
  () => form.value.category_major_id,
  majorId => {
    if (majorId && !form.value.category_minor_id && filteredMinors.value.length) {
      form.value.category_minor_id = filteredMinors.value[0].category_minor_id;
    }
  },
);

onMounted(async () => {
  const pageSize = 200;
  try {
    const [ projects, schemes, valRes, majorRes, minorRes, priRes ] = await Promise.all([
      fetchProjects({ page: 1, pageSize }),
      fetchSchemes({ pageSize }),
      fetchEnums('test_validation_enum', { page: 1, pageSize }),
      fetchEnums('test_category_major', { page: 1, pageSize }),
      fetchEnums('test_category_minor', { page: 1, pageSize: 500 }),
      fetchEnums('test_priority_enum', { page: 1, pageSize: 20 }),
    ]);
    projectOptions.value = projects.list || [];
    schemeOptions.value = schemes.schemes || schemes.list || [];
    priorityOptions.value = priRes.list || [];
    majorOptions.value = majorRes.list || [];
    minorOptions.value = minorRes.list || [];
  } catch {
    ElMessage.warning('加载枚举数据失败，请刷新重试');
  }
});
</script>

<style scoped>
.manual-item-form {
  max-width: 880px;
}
.hint {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
}
</style>
