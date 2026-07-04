<template>
  <PageShell :title="plan?.name || '计划详情'" v-loading="loading">
    <template #extra>
      <el-button @click="router.push('/fitness/plans')">返回</el-button>
      <el-button
        type="primary"
        :loading="launching"
        :disabled="!launchItemIds.length || plan?.status === 'running'"
        @click="handleLaunch"
      >
        批量执行{{ launchLabelSuffix }}
      </el-button>
      <el-button type="primary" plain @click="router.push(`/fitness/plans/${id}/report`)">完成报告</el-button>
    </template>

    <el-descriptions v-if="plan" :column="2" border>
      <el-descriptions-item label="版本">{{ plan.version_tag || '-' }}</el-descriptions-item>
      <el-descriptions-item label="环境">{{ plan.env_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType">{{ plan.status }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="用例数">{{ plan.items?.length || 0 }}</el-descriptions-item>
    </el-descriptions>
    
    <el-alert
      v-if="runSummary"
      type="info"
      :closable="false"
      style="margin: 16px 0"
      :title="`通过 ${runSummary.passed} · 失败 ${runSummary.failed} · 跳过 ${runSummary.skipped} · 待执行 ${runSummary.pending}`"
    />

    <el-form v-if="plan?.status !== 'running'" label-width="100px" style="margin-top: 12px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="执行环境">
            <el-select v-model="envId" placeholder="选择环境" style="width: 100%">
              <el-option
                v-for="e in envs"
                :key="e.id"
                :label="e.name + (e.is_default ? ' (默认)' : '')"
                :value="e.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="执行状态">
            <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 100%">
              <el-option label="全部" value="" />
              <el-option label="待执行 pending" value="pending" />
              <el-option label="通过 passed" value="passed" />
              <el-option label="失败 failed" value="failed" />
              <el-option label="跳过 skipped" value="skipped" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <p v-if="filteredTableRows.length" class="filter-hint">
      显示 {{ filteredTableRows.length }} / {{ tableRows.length }} 条
      <span v-if="selectedRows.length"> · 已选 {{ selectedRows.length }} 条</span>
    </p>

    <el-divider />
    <el-table
      ref="tableRef"
      :data="filteredTableRows"
      size="small"
      row-key="item_id"
      :max-height="400"
      @selection-change="selectedRows = $event"
    >
      <el-table-column type="selection" width="48" reserve-selection />
      <el-table-column prop="item_id" label="用例 ID" width="160" />
      <el-table-column prop="scheme_primary_id" label="TS" width="120" />
      <el-table-column label="结果" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="resultTagType(row.result_status)">{{ row.result_status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="validation_result" label="VS 判定" width="100" />
      <el-table-column label="Run" width="80">
        <template #default="{ row }">
          <el-button v-if="row.ft_run_id" link @click="router.push(`/fitness/execution/runs/${row.ft_run_id}`)">
            #{{ row.ft_run_id }}
          </el-button>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link @click="router.push(`/fitness/assets/items/${row.item_id}`)">资产</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-card v-if="plan && scopeGoals.length" shadow="never" style="margin-top: 16px">
      <template #header>PRD 目标范围</template>
      <ul class="meta-list">
        <li v-for="s in scopeGoals" :key="s.id">{{ s.scope_value }}</li>
      </ul>
    </el-card>

    <el-card v-if="plan && plan.thresholds?.length" shadow="never" style="margin-top: 12px">
      <template #header>阈值配置</template>
      <el-table :data="plan.thresholds" size="small">
        <el-table-column prop="param_id" label="参数 ID" width="160" />
        <el-table-column label="配置值">
          <template #default="{ row }">
            {{ row.notes || row.param_value }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="plan" shadow="never" style="margin-top: 12px">
      <template #header>发版放行标准</template>
      <ul class="meta-list">
        <li v-for="(line, i) in planMeta.release_criteria" :key="i">{{ line }}</li>
      </ul>
    </el-card>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import { parsePlanMeta } from '@/constants/planReleaseCriteria.js';
import {
  fetchEnvironments,
  fetchPlan,
  fetchPlanRuns,
  launchPlan,
} from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const loading = ref(false);
const launching = ref(false);
const plan = ref(null);
const runSummary = ref(null);
const envs = ref([]);
const envId = ref(null);
const statusFilter = ref('');
const selectedRows = ref([]);
const tableRef = ref(null);
let pollTimer = null;

const planMeta = computed(() => parsePlanMeta(plan.value?.notes));

const scopeGoals = computed(() =>
  (plan.value?.scope || []).filter(s => s.scope_type === 'prd_goal'),
);

const statusTagType = computed(() => {
  const s = plan.value?.status;
  if (s === 'completed') return 'success';
  if (s === 'running') return 'warning';
  if (s === 'partial_failed' || s === 'failed') return 'danger';
  return 'info';
});

const tableRows = computed(() => {
  const items = plan.value?.items || [];
  const results = plan.value?.results || [];
  return items.map(item => {
    const result = results.find(r => r.plan_item_id === item.id);
    return {
      ...item,
      result_status: result?.result_status || 'pending',
      validation_result: result?.validation_result || '',
      ft_run_id: result?.ft_run_id || null,
    };
  });
});

const filteredTableRows = computed(() => {
  if (!statusFilter.value) return tableRows.value;
  return tableRows.value.filter(r => r.result_status === statusFilter.value);
});

const launchItemIds = computed(() => {
  if (selectedRows.value.length) {
    return selectedRows.value.map(r => r.item_id);
  }
  return filteredTableRows.value.map(r => r.item_id);
});

const launchLabelSuffix = computed(() => {
  const count = launchItemIds.value.length;
  if (!count) return '';
  if (selectedRows.value.length) return ` (${selectedRows.value.length} 条已选)`;
  if (statusFilter.value) return ` (${count} 条${statusFilter.value})`;
  return ` (${count} 条)`;
});

watch(statusFilter, () => {
  tableRef.value?.clearSelection?.();
  selectedRows.value = [];
});

function resultTagType(status) {
  if (status === 'passed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'skipped') return 'info';
  return 'warning';
}

async function reload() {
  plan.value = await fetchPlan(id);
  runSummary.value = await fetchPlanRuns(id);
}

async function handleLaunch() {
  const itemIds = launchItemIds.value;
  if (!itemIds.length) {
    ElMessage.warning('没有可执行的用例');
    return;
  }
  launching.value = true;
  try {
    await launchPlan(id, {
      env_id: envId.value,
      skip_unlaunchable: true,
      item_ids: itemIds,
    });
    ElMessage.success(`已启动 ${itemIds.length} 条用例的批量执行`);
    await reload();
    startPolling();
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '启动失败');
  } finally {
    launching.value = false;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    await reload();
    if (plan.value?.status !== 'running') stopPolling();
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const envData = await fetchEnvironments({ pageSize: 50 });
    envs.value = envData.list || [];
    envId.value = envs.value.find(e => e.is_default)?.id ?? envs.value[0]?.id ?? null;
    await reload();
    if (plan.value?.status === 'running') startPolling();
  } finally {
    loading.value = false;
  }
});

onUnmounted(stopPolling);
</script>

<style scoped>
.meta-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}
.filter-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
