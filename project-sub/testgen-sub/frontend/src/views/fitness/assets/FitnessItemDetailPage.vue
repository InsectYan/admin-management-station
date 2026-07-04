<template>
  <div v-loading="loading">
    <el-descriptions v-if="item" :column="2" border>
      <el-descriptions-item label="ID">{{ item.item_id }}</el-descriptions-item>
      <el-descriptions-item label="项目">{{ item.project_name || item.project_code }}</el-descriptions-item>
      <el-descriptions-item label="优先级">{{ item.priority_name || item.priority_id }}</el-descriptions-item>
      <el-descriptions-item label="分类">{{ item.dimension_name }} / {{ item.category_major_name }}</el-descriptions-item>
      <el-descriptions-item label="来源">{{ item.source_doc }} {{ item.source_section }}</el-descriptions-item>
      <el-descriptions-item label="主方案">
        <SchemeCodeNameCell :code="item.scheme_primary_id" :name="item.scheme_primary_name" />
      </el-descriptions-item>
      <el-descriptions-item label="主验证">
        <SchemeCodeNameCell :code="item.validation_primary_id" :name="item.validation_primary_name" />
      </el-descriptions-item>
      <el-descriptions-item label="六站/三端">{{ item.station_name || item.station_id }} / {{ item.role_scope_name || item.role_scope_id }}</el-descriptions-item>
      <el-descriptions-item label="自动化">{{ item.automation_status_name || item.automation_status_id }}</el-descriptions-item>
      <el-descriptions-item label="配置模板">{{ item.template_name || item.template_code || '—' }}</el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">辅方案配置</el-divider>
    <el-form v-if="item" label-width="100px" class="secondary-form">
      <el-form-item label="辅方案">
        <el-select
          v-model="secondaryForm.scheme_secondary_id"
          clearable
          filterable
          placeholder="可选，与主方案串联执行"
          style="width: 320px"
          @change="onSecondarySchemeChange"
        >
          <el-option
            v-for="s in schemeOptions"
            :key="s.scheme_id"
            :label="`${s.scheme_id} · ${s.name}`"
            :value="s.scheme_id"
            :disabled="s.scheme_id === item.scheme_primary_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="辅验证">
        <el-select
          v-model="secondaryForm.validation_secondary_id"
          clearable
          filterable
          :disabled="!secondaryForm.scheme_secondary_id"
          placeholder="选择辅方案对应验证"
          style="width: 320px"
        >
          <el-option
            v-for="v in secondaryValidationOptions"
            :key="v.validation_id"
            :label="`${v.validation_id} · ${v.name}`"
            :value="v.validation_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="savingSchemes" @click="saveSecondarySchemes">保存辅方案</el-button>
        <span v-if="item.scheme_secondary_id" class="hint">执行时将主方案完成后自动串联辅方案</span>
      </el-form-item>
    </el-form>

    <el-divider content-position="left">测什么</el-divider>
    <p>{{ item?.detail_summary }}</p>
    <p><strong>期望:</strong> {{ item?.expected_observation || '—' }}</p>
    <p v-if="item?.test_input_example"><strong>输入示例:</strong> {{ item.test_input_example }}</p>

    <el-divider content-position="left">怎么执行</el-divider>
    <el-row :gutter="16">
      <el-col :span="6"><h5>前置条件</h5><ul><li v-for="(p,i) in item?.preconditions||[]" :key="i">{{ p }}</li></ul></el-col>
      <el-col :span="6"><h5>测试步骤</h5><ol><li v-for="(s,i) in item?.test_steps||[]" :key="i">{{ s }}</li></ol></el-col>
      <el-col :span="6"><h5>断言点</h5><ul><li v-for="(a,i) in item?.assertion_points||[]" :key="i">{{ a }}</li></ul></el-col>
      <el-col :span="6"><h5>执行说明</h5><p>{{ item?.sample_execution_note || '-' }}</p></el-col>
    </el-row>
    <p v-if="item?.automation_command" class="cmd-block"><strong>自动化命令:</strong> <code>{{ item.automation_command }}</code></p>

    <el-divider content-position="left">关联图谱</el-divider>
    <el-tabs>
      <el-tab-pane label="PRD 目标">
        <el-tag
          v-for="g in item?.links?.prdGoals||[]"
          :key="g.link_id"
          style="margin:4px"
          class="link-tag"
        >{{ g.goal_name || g.prd_goal_id }}</el-tag>
      </el-tab-pane>
      <el-tab-pane label="架构引用">
        <el-tag v-for="a in item?.links?.archRefs||[]" :key="a.arch_ref_id" style="margin:4px">{{ a.title || a.arch_ref_id }}</el-tag>
      </el-tab-pane>
      <el-tab-pane label="风险关系">
        <el-table :data="item?.links?.riskLinks||[]" size="small" @row-click="goRelatedItem">
          <el-table-column prop="direction" label="方向" width="120" />
          <el-table-column label="源用例" min-width="160">
            <template #default="{ row }">{{ row.source_item_name || row.source_item_id }}</template>
          </el-table-column>
          <el-table-column label="目标用例" min-width="160">
            <template #default="{ row }">{{ row.target_item_name || row.target_item_id }}</template>
          </el-table-column>
          <el-table-column label="关系" width="100">
            <template #default="{ row }">
              <el-tag :type="relationTag(row.relation_type_id).type" size="small">
                {{ row.relation_type_name || relationTag(row.relation_type_id).label }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import SchemeCodeNameCell from '@/components/fitness/SchemeCodeNameCell.vue';
import {
  fetchSchemes,
  fetchSchemeValidations,
  fetchTestItem,
  updateItemSchemes,
} from '@/services/fitnessService.js';
import { riskRelationTag } from '@/utils/fitnessExport.js';
import { buildItemDetailRoute } from '@/utils/itemListQuery.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const savingSchemes = ref(false);
const item = ref(null);
const schemeOptions = ref([]);
const secondaryValidationOptions = ref([]);
const secondaryForm = reactive({
  scheme_secondary_id: '',
  validation_secondary_id: '',
});

function relationTag(typeId) {
  return riskRelationTag(typeId);
}

function syncSecondaryForm() {
  secondaryForm.scheme_secondary_id = item.value?.scheme_secondary_id || '';
  secondaryForm.validation_secondary_id = item.value?.validation_secondary_id || '';
}

async function loadSecondaryValidations(schemeId) {
  if (!schemeId) {
    secondaryValidationOptions.value = [];
    return;
  }
  secondaryValidationOptions.value = await fetchSchemeValidations(schemeId);
}

async function onSecondarySchemeChange(schemeId) {
  if (!schemeId) {
    secondaryForm.validation_secondary_id = '';
    secondaryValidationOptions.value = [];
    return;
  }
  await loadSecondaryValidations(schemeId);
  if (!secondaryValidationOptions.value.some(v => v.validation_id === secondaryForm.validation_secondary_id)) {
    const primary = secondaryValidationOptions.value.find(v => v.is_primary);
    secondaryForm.validation_secondary_id = primary?.validation_id
      || secondaryValidationOptions.value[0]?.validation_id
      || '';
  }
}

async function saveSecondarySchemes() {
  savingSchemes.value = true;
  try {
    item.value = await updateItemSchemes(route.params.itemId, {
      scheme_secondary_id: secondaryForm.scheme_secondary_id || null,
      validation_secondary_id: secondaryForm.validation_secondary_id || null,
    });
    syncSecondaryForm();
    ElMessage.success('辅方案已保存');
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  } finally {
    savingSchemes.value = false;
  }
}

function goRelatedItem(row) {
  const peerId = row.source_item_id === route.params.itemId ? row.target_item_id : row.source_item_id;
  if (peerId && peerId !== route.params.itemId) {
    router.push(buildItemDetailRoute(peerId, { query: route.query }));
  }
}

async function loadItem() {
  loading.value = true;
  try {
    item.value = await fetchTestItem(route.params.itemId);
    syncSecondaryForm();
    if (secondaryForm.scheme_secondary_id) {
      await loadSecondaryValidations(secondaryForm.scheme_secondary_id);
    }
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.itemId, loadItem);

onMounted(async () => {
  const schemesData = await fetchSchemes({ pageSize: 100 });
  schemeOptions.value = schemesData.schemes || schemesData.list || [];
  await loadItem();
});
</script>

<style scoped>
.cmd-block code {
  display: inline-block;
  margin-top: 4px;
  padding: 4px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  word-break: break-all;
}
.secondary-form {
  max-width: 640px;
}
.hint {
  margin-left: 12px;
  color: #909399;
  font-size: 13px;
}
</style>
