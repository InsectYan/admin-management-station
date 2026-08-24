<template>
  <div v-loading="loading">
    <div class="detail-toolbar">
      <el-button type="primary" data-testid="fitness-item-edit" @click="editOpen = true">编辑</el-button>
      <router-link :to="configRoute" class="hint">前往配置页（运行时请求/断言）</router-link>
    </div>

    <el-alert
      v-if="lastMigration"
      :title="lastMigration.hint"
      type="success"
      :closable="true"
      show-icon
      style="margin-bottom:12px"
      @close="lastMigration = null"
    >
      <template v-if="lastMigration.scheme_changed">
        TS：{{ lastMigration.old_scheme_id }} → {{ lastMigration.new_scheme_id }}；
        模板：{{ lastMigration.template_code }}
        <span v-if="lastMigration.validation_auto_adjusted">；判定方式已自动匹配</span>
      </template>
    </el-alert>

    <el-descriptions v-if="item" :column="2" border>
      <el-descriptions-item label="ID">{{ item.item_id }}</el-descriptions-item>
      <el-descriptions-item label="项目">{{ item.project_name || item.project_code }}</el-descriptions-item>
      <el-descriptions-item label="用例名称">{{ item.item_name || '—' }}</el-descriptions-item>
      <el-descriptions-item label="优先级">{{ item.priority_name || item.priority_id }}</el-descriptions-item>
      <el-descriptions-item label="测试分类">{{ formatCategoryDisplay(item.category_major_id, item.category_major_name) }}</el-descriptions-item>
      <el-descriptions-item label="测试小类">{{ item.category_minor_name || item.category_minor_id || '—' }}</el-descriptions-item>
      <el-descriptions-item label="来源">{{ item.source_doc }} {{ item.source_section }}</el-descriptions-item>
      <el-descriptions-item label="生成任务">
        <template v-if="item.generation_job_id">
          <router-link :to="{ name: 'generation-progress', params: { id: item.generation_job_id } }">
            #{{ item.generation_job_id }}
          </router-link>
          <span v-if="item.generation_task_name"> · {{ item.generation_task_name }}</span>
        </template>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="六站/业务角色">{{ item.station_name || item.station_id }} / {{ item.role_scope_name || item.role_scope_id }}</el-descriptions-item>
      <el-descriptions-item label="自动化">{{ item.automation_status_name || item.automation_status_id }}</el-descriptions-item>
      <el-descriptions-item label="最新执行 ID">
        <router-link
          v-if="item.latest_ft_run_id"
          :to="`/fitness/execution/runs/${item.latest_ft_run_id}`"
        >
          #{{ item.latest_ft_run_id }}
        </router-link>
        <span v-else>—</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">执行方案（TS）与判定方式（VS）</el-divider>
    <el-descriptions v-if="item" :column="2" border>
      <el-descriptions-item label="执行方案（TS）">
        {{ formatSchemeLabel(item.scheme_primary_id, item.scheme_primary_name) }}
      </el-descriptions-item>
      <el-descriptions-item label="判定方式（VS）">
        {{ formatValidationLabel(item.validation_primary_id, item.validation_primary_name) }}
      </el-descriptions-item>
      <el-descriptions-item label="配置模板">
        {{ item.template_code || '—' }}
        <span v-if="item.template_code"> · {{ TEMPLATE_DISPLAY_NAMES[item.template_code] || '' }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="辅执行方案">
        <template v-if="item.scheme_secondary_id">
          {{ formatSchemeLabel(item.scheme_secondary_id, item.scheme_secondary_name) }}
          /
          {{ formatValidationLabel(item.validation_secondary_id, item.validation_secondary_name) }}
        </template>
        <span v-else>—</span>
      </el-descriptions-item>
    </el-descriptions>

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

    <FitnessItemEditDrawer
      v-model="editOpen"
      :item="item"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { inject, onMounted, ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TEMPLATE_DISPLAY_NAMES } from '@/components/config-templates/registry.js';
import FitnessItemEditDrawer from '@/views/fitness/assets/FitnessItemEditDrawer.vue';
import { fetchTestItem } from '@/services/fitnessService.js';
import { riskRelationTag } from '@/utils/fitnessExport.js';
import { buildItemDetailRoute } from '@/utils/itemListQuery.js';
import {
  formatCategoryDisplay,
  formatSchemeLabel,
  formatValidationLabel,
} from '@/utils/testCategoryDisplay.js';

const route = useRoute();
const router = useRouter();
const reloadLayoutItem = inject('reloadFitnessItem', null);

const loading = ref(false);
const item = ref(null);
const editOpen = ref(false);
const lastMigration = ref(null);

const configRoute = computed(() =>
  buildItemDetailRoute(route.params.itemId, { module: 'config', query: route.query }),
);

function relationTag(typeId) {
  return riskRelationTag(typeId);
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
  } finally {
    loading.value = false;
  }
}

async function onSaved(data) {
  lastMigration.value = data?.scheme_migration || null;
  item.value = data;
  await loadItem();
  if (typeof reloadLayoutItem === 'function') {
    await reloadLayoutItem();
  }
}

watch(() => route.params.itemId, loadItem);
onMounted(loadItem);
</script>

<style scoped>
.detail-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.cmd-block code {
  display: inline-block;
  margin-top: 4px;
  padding: 4px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  word-break: break-all;
}
.hint {
  color: #909399;
  font-size: 13px;
}
</style>
