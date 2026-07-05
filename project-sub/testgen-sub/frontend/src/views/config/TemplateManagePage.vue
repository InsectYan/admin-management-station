<template>
  <PageShell title="用例模板">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="大类列表" name="majors">
        <el-table v-loading="loading" :data="majorRows" border stripe size="small" max-height="calc(100vh - 220px)">
          <el-table-column prop="category_major_id" label="大类 ID" width="90" />
          <el-table-column prop="major_name" label="名称" min-width="120" />
          <el-table-column prop="dimension_name" label="维度" width="100" />
          <el-table-column label="挂载模板" min-width="140">
            <template #default="{ row }">
              <el-tag v-if="row.is_mixed" type="warning" size="small">混合 TS</el-tag>
              <template v-else>
                <el-tag type="primary" size="small">{{ row.template_code || '—' }}</el-tag>
                <span v-if="row.template_name" class="cell-meta">{{ row.template_name }}</span>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="主验证" min-width="140">
            <template #default="{ row }">
              <el-tag v-if="row.default_validation_id" size="small">{{ row.default_validation_id }}</el-tag>
              <span v-if="row.validation_name" class="cell-meta">{{ row.validation_name }}</span>
              <span v-else class="cell-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="major_description" label="说明" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="88" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openMajorDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="模板列表" name="templates">
        <el-table v-loading="loading" :data="templateRows" border stripe size="small" max-height="calc(100vh - 220px)">
          <el-table-column prop="template_code" label="模板 ID" width="110" />
          <el-table-column prop="name" label="名称" width="120" />
          <el-table-column label="映射方案" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.scheme_id" size="small" type="warning">{{ row.scheme_id }}</el-tag>
              <span v-else class="cell-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="function_desc" label="功能" min-width="160" show-overflow-tooltip />
          <el-table-column prop="scenario_desc" label="适用场景" min-width="180" show-overflow-tooltip />
          <el-table-column label="关联大类" min-width="220">
            <template #default="{ row }">
              <TagOverflowCell
                :items="row.linked_majors || []"
                :label-fn="formatLinkedMajorLabel"
                :item-key-fn="linkedMajorKey"
              />
            </template>
          </el-table-column>
          <el-table-column label="验证方案" min-width="160">
            <template #default="{ row }">
              <el-tag
                v-for="vid in row.validation_ids || []"
                :key="vid"
                size="small"
                type="success"
                style="margin: 2px"
              >
                {{ vid }}
              </el-tag>
              <span v-if="!(row.validation_ids || []).length" class="cell-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="88" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openTemplateDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 大类详情 -->
    <el-drawer v-model="majorDrawerVisible" :title="majorDetailTitle" size="640px" destroy-on-close>
      <template v-if="majorDetail">
        <el-descriptions :column="1" border size="small" class="detail-block">
          <el-descriptions-item label="维度">{{ majorDetail.dimension_name }} ({{ majorDetail.dimension_id }})</el-descriptions-item>
          <el-descriptions-item label="说明">{{ majorDetail.major_description || '—' }}</el-descriptions-item>
        </el-descriptions>

        <el-form label-width="100px" class="detail-form">
          <el-form-item label="配置模板">
            <el-select
              v-model="majorEdit.template_code"
              :disabled="majorDetail.is_mixed"
              filterable
              style="width: 100%"
              @change="onMajorTemplateChange"
            >
              <el-option
                v-for="t in allTemplates"
                :key="t.template_code"
                :label="`${t.template_code} · ${t.name}`"
                :value="t.template_code"
              />
            </el-select>
            <div v-if="majorDetail.is_mixed" class="form-hint">混合 TS 大类，用例级按 scheme 解析模板</div>
          </el-form-item>
          <el-form-item label="主验证">
            <el-select
              v-model="majorEdit.validation_id"
              filterable
              style="width: 100%"
              :loading="validationLoading"
              @change="onMajorValidationChange"
            >
              <el-option
                v-for="v in majorValidations"
                :key="v.validation_id"
                :label="`${v.validation_id} ${v.name || ''}`.trim()"
                :value="v.validation_id"
              />
            </el-select>
          </el-form-item>
        </el-form>

        <el-card v-if="majorPreviewItem && majorPanelComponent" shadow="never">
          <template #header>
            <span>模板预览 · {{ majorEdit.template_code || 'TPL-CHAIN' }}</span>
            <el-tag size="small" style="margin-left:8px">只读</el-tag>
          </template>
          <component
            :is="majorPanelComponent"
            :item="majorPreviewItem"
            :model-value="demoConfig"
            :threshold="demoThreshold"
            :readonly="true"
          />
        </el-card>
      </template>
    </el-drawer>

    <!-- 模板详情 -->
    <el-drawer v-model="templateDrawerVisible" :title="templateDetailTitle" size="640px" destroy-on-close>
      <template v-if="templateDetail">
        <el-descriptions :column="1" border size="small" class="detail-block">
          <el-descriptions-item label="功能">{{ templateDetail.function_desc || templateDetail.description || '—' }}</el-descriptions-item>
          <el-descriptions-item label="适用场景">{{ templateDetail.scenario_desc || '—' }}</el-descriptions-item>
          <el-descriptions-item label="测试方案">{{ templateDetail.scheme_id }} {{ templateDetail.scheme_name || '' }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-block">
          <div class="detail-label">关联大类</div>
          <el-tag
            v-for="m in templateDetail.linked_majors || []"
            :key="m.category_major_id"
            size="small"
            style="margin: 2px"
          >
            {{ m.category_major_id }} · {{ m.major_name }}
          </el-tag>
        </div>

        <el-form label-width="100px" class="detail-form">
          <el-form-item label="验证方案">
            <el-select
              v-model="templateEdit.validation_id"
              filterable
              style="width: 100%"
              :loading="validationLoading"
              @change="onTemplateValidationChange"
            >
              <el-option
                v-for="v in templateValidations"
                :key="v.validation_id"
                :label="`${v.validation_id} ${v.name || ''}`.trim()"
                :value="v.validation_id"
              />
            </el-select>
            <div class="form-hint">切换后将同步更新所有关联大类的 default_validation_id</div>
          </el-form-item>
        </el-form>

        <el-card v-if="templatePreviewItem && templatePanelComponent" shadow="never">
          <template #header>
            <span>模板预览 · {{ templateDetail.template_code }}</span>
            <el-tag size="small" style="margin-left:8px">只读</el-tag>
          </template>
          <component
            :is="templatePanelComponent"
            :item="templatePreviewItem"
            :model-value="demoConfig"
            :threshold="demoThreshold"
            :readonly="true"
          />
        </el-card>
      </template>
    </el-drawer>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import TagOverflowCell from '@/components/TagOverflowCell.vue';
import { resolveTemplateComponent } from '@/components/config-templates/registry.js';
import {
  fetchMajorsTemplateOverview,
  fetchSchemeValidations,
  fetchTemplateList,
  fetchTemplatesOverview,
  fetchTestItems,
  updateMajorTemplate,
  updateMajorValidation,
  updateTemplateValidation,
} from '@/services/fitnessService.js';

const activeTab = ref('majors');
const loading = ref(false);
const validationLoading = ref(false);
const majorRows = ref([]);
const templateRows = ref([]);
const allTemplates = ref([]);

const majorDrawerVisible = ref(false);
const majorDetail = ref(null);
const majorEdit = ref({ template_code: '', validation_id: '' });
const majorValidations = ref([]);
const majorPreviewItem = ref(null);

const templateDrawerVisible = ref(false);
const templateDetail = ref(null);
const templateEdit = ref({ validation_id: '' });
const templateValidations = ref([]);
const templatePreviewItem = ref(null);

const demoConfig = ref({});
const demoThreshold = ref({});

const majorDetailTitle = computed(() =>
  majorDetail.value ? `${majorDetail.value.category_major_id} · ${majorDetail.value.major_name}` : '大类详情',
);
const templateDetailTitle = computed(() =>
  templateDetail.value ? `${templateDetail.value.template_code} · ${templateDetail.value.name}` : '模板详情',
);

const majorPanelComponent = computed(() =>
  resolveTemplateComponent(majorEdit.value.template_code || 'TPL-CHAIN'),
);
const templatePanelComponent = computed(() =>
  resolveTemplateComponent(templateDetail.value?.template_code || 'TPL-DET'),
);

function formatLinkedMajorLabel(major) {
  if (!major) return '—';
  const name = major.major_name || major.name || '';
  return name ? `${major.category_major_id} · ${name}` : (major.category_major_id || '—');
}

function linkedMajorKey(major) {
  return major?.category_major_id || '';
}

async function loadMajors() {
  majorRows.value = await fetchMajorsTemplateOverview();
}

async function loadTemplates() {
  templateRows.value = await fetchTemplatesOverview();
}

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([ loadMajors(), loadTemplates(), loadTemplateOptions() ]);
  } finally {
    loading.value = false;
  }
}

async function loadTemplateOptions() {
  allTemplates.value = await fetchTemplateList();
}

function onTabChange() {
  // data already loaded
}

async function loadPreviewForMajor(majorId, templateCode, validationId) {
  const data = await fetchTestItems({ category_major_id: majorId, page: 1, pageSize: 1 });
  const row = data.list?.[0];
  if (row) {
    majorPreviewItem.value = row;
    demoConfig.value = {
      endpoint_path: row.endpoint_path,
      test_input_example: row.test_input_example,
      http_status_expected: row.http_status_expected,
    };
    return;
  }
  majorPreviewItem.value = {
    item_id: `${majorId}-DEMO-001`,
    detail_summary: `${majorDetail.value?.major_name || majorId} 演示用例`,
    validation_primary_id: validationId || 'VS-01-EXACT',
    http_method: 'GET',
    endpoint_path: '/health',
    http_status_expected: 200,
    assertion_points: [ 'HTTP 200', '响应字段完整' ],
  };
  demoConfig.value = {};
  demoThreshold.value = {};
}

async function loadPreviewForTemplate(templateCode) {
  const linked = templateDetail.value?.linked_majors || [];
  const majorId = linked[0]?.category_major_id;
  if (!majorId) {
    templatePreviewItem.value = {
      item_id: `${templateCode}-DEMO-001`,
      detail_summary: `${templateDetail.value?.name || templateCode} 演示用例`,
      validation_primary_id: templateEdit.value.validation_id || 'VS-01-EXACT',
      http_method: 'GET',
      endpoint_path: '/health',
      http_status_expected: 200,
    };
    demoConfig.value = {};
    return;
  }
  await loadPreviewForMajor(majorId, templateCode, templateEdit.value.validation_id);
  templatePreviewItem.value = majorPreviewItem.value;
}

async function loadValidationsForScheme(schemeId) {
  validationLoading.value = true;
  try {
    return await fetchSchemeValidations(schemeId);
  } finally {
    validationLoading.value = false;
  }
}

async function openMajorDetail(row) {
  majorDetail.value = row;
  majorEdit.value = {
    template_code: row.template_code || 'TPL-CHAIN',
    validation_id: row.default_validation_id || '',
  };
  const schemeId = row.scheme_id || row.default_scheme_id;
  majorValidations.value = schemeId ? await loadValidationsForScheme(schemeId) : [];
  majorDrawerVisible.value = true;
  await loadPreviewForMajor(row.category_major_id, majorEdit.value.template_code, majorEdit.value.validation_id);
}

async function openTemplateDetail(row) {
  templateDetail.value = row;
  const defaultVs = (row.validation_ids || [])[0] || '';
  templateEdit.value = { validation_id: defaultVs };
  templateValidations.value = row.scheme_id ? await loadValidationsForScheme(row.scheme_id) : [];
  templateDrawerVisible.value = true;
  await loadPreviewForTemplate(row.template_code);
}

async function onMajorTemplateChange(code) {
  try {
    await updateMajorTemplate(majorDetail.value.category_major_id, code);
    const tpl = allTemplates.value.find(t => t.template_code === code);
    if (tpl?.scheme_id) {
      majorValidations.value = await loadValidationsForScheme(tpl.scheme_id);
    }
    await loadMajors();
    majorDetail.value = majorRows.value.find(m => m.category_major_id === majorDetail.value.category_major_id);
    ElMessage.success('模板已切换');
    await loadPreviewForMajor(majorDetail.value.category_major_id, code, majorEdit.value.validation_id);
  } catch (err) {
    ElMessage.error(err.message || '切换模板失败');
    majorEdit.value.template_code = majorDetail.value.template_code;
  }
}

async function onMajorValidationChange(validationId) {
  try {
    await updateMajorValidation(majorDetail.value.category_major_id, validationId);
    await loadMajors();
    majorDetail.value = majorRows.value.find(m => m.category_major_id === majorDetail.value.category_major_id);
    ElMessage.success('验证方案已更新');
  } catch (err) {
    ElMessage.error(err.message || '更新验证方案失败');
    majorEdit.value.validation_id = majorDetail.value.default_validation_id;
  }
}

async function onTemplateValidationChange(validationId) {
  try {
    const result = await updateTemplateValidation(templateDetail.value.template_code, validationId);
    await loadMajors();
    await loadTemplates();
    templateDetail.value = templateRows.value.find(t => t.template_code === templateDetail.value.template_code);
    ElMessage.success(`验证方案已同步至 ${result.updated_majors || 0} 个大类`);
  } catch (err) {
    ElMessage.error(err.message || '更新验证方案失败');
  }
}

onMounted(loadAll);
</script>

<style scoped>
.cell-meta {
  margin-left: 6px;
  color: #606266;
  font-size: 12px;
}
.cell-muted {
  color: #909399;
  font-size: 12px;
}
.detail-block {
  margin-bottom: 16px;
}
.detail-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}
.detail-form {
  margin-bottom: 16px;
}
.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
</style>

