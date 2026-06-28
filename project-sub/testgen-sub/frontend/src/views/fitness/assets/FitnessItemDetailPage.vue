<template>
  <PageShell :title="item?.item_name || '测试项详情'" v-loading="loading">
    <template #extra>
      <el-button @click="router.push('/fitness/assets/items')">返回列表</el-button>
      <el-button v-if="item?.automation_command" type="warning" @click="copyCommand">复制命令</el-button>
      <el-button @click="router.push(`/fitness/execution/run/${itemId}/config/${configPath}`)">配置</el-button>
      <el-button type="primary" @click="router.push(`/fitness/execution/run/${itemId}/launch`)">执行</el-button>
      <el-button @click="router.push({ path: '/fitness/execution/center', query: { itemId } })">历史</el-button>
    </template>

    <el-descriptions v-if="item" :column="2" border>
      <el-descriptions-item label="ID">{{ item.item_id }}</el-descriptions-item>
      <el-descriptions-item label="优先级">{{ item.priority_name || item.priority_id }}</el-descriptions-item>
      <el-descriptions-item label="分类">{{ item.dimension_name }} / {{ item.category_major_name }}</el-descriptions-item>
      <el-descriptions-item label="来源">{{ item.source_doc }} {{ item.source_section }}</el-descriptions-item>
      <el-descriptions-item label="TS">
        {{ item.scheme_primary_name || item.scheme_primary_id }}
        <span v-if="item.scheme_secondary_id"> + {{ item.scheme_secondary_name || item.scheme_secondary_id }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="VS">{{ item.validation_primary_name || item.validation_primary_id }}</el-descriptions-item>
      <el-descriptions-item label="六站/三端">{{ item.station_name || item.station_id }} / {{ item.role_scope_name || item.role_scope_id }}</el-descriptions-item>
      <el-descriptions-item label="自动化">{{ item.automation_status_name || item.automation_status_id }}</el-descriptions-item>
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
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import { fetchTestItem, schemeToConfigPath } from '@/services/fitnessService.js';
import { riskRelationTag } from '@/utils/fitnessExport.js';

const route = useRoute();
const router = useRouter();
const itemId = computed(() => route.params.itemId);
const loading = ref(false);
const item = ref(null);
const configPath = computed(() => schemeToConfigPath(item.value?.scheme_primary_id));

function relationTag(typeId) {
  return riskRelationTag(typeId);
}

function goRelatedItem(row) {
  const peerId = row.source_item_id === itemId.value ? row.target_item_id : row.source_item_id;
  if (peerId && peerId !== itemId.value) {
    router.push(`/fitness/assets/items/${encodeURIComponent(peerId)}`);
  }
}

async function copyCommand() {
  if (!item.value?.automation_command) return;
  await navigator.clipboard.writeText(item.value.automation_command);
  ElMessage.success('已复制自动化命令');
}

onMounted(async () => {
  loading.value = true;
  try {
    item.value = await fetchTestItem(itemId.value);
  } finally {
    loading.value = false;
  }
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
</style>
