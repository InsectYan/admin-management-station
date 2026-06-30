<template>
  <PageShell title="风险中心">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="风险清单" name="list">
        <div class="risk-filters">
          <el-select
            v-model="coverageStatus"
            placeholder="覆盖状态"
            clearable
            style="width:140px"
            @change="onFilterChange"
          >
            <el-option label="已覆盖" value="COVERED" />
            <el-option label="部分覆盖" value="PARTIAL" />
            <el-option label="缺口" value="GAP" />
          </el-select>
          <el-input
            v-model="reverseItemId"
            placeholder="反向查 item_id"
            clearable
            style="width:180px"
            @change="onFilterChange"
            @clear="onFilterChange"
          />
        </div>
        <FitnessLabeledTable
          :data="risks"
          :columns="riskColumns"
          :page="page"
          :page-size="pageSize"
          :total="total"
          :loading="loading"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
          @change="loadRisks"
          @row-click="goDetail"
        />
      </el-tab-pane>
      <el-tab-pane label="关联图" name="graph">
        <el-input
          v-model="reverseItemId"
          placeholder="反向查 item_id"
          clearable
          style="width:180px;margin-bottom:12px"
          @change="loadLinks"
          @clear="loadLinks"
        />
        <FitnessLabeledTable
          :data="links"
          :columns="linkColumns"
          :page="linkPage"
          :page-size="linkPageSize"
          :total="linkTotal"
          :loading="loading"
          @update:page="linkPage = $event"
          @update:page-size="linkPageSize = $event"
          @change="loadLinks"
        />
      </el-tab-pane>
      <el-tab-pane label="覆盖缺口" name="gap">
        <el-button link type="primary" @click="router.push('/fitness/insights/analysis/risk-gap')">查看分析视图</el-button>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchRisks, fetchRiskLinks } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const activeTab = ref('list');
const coverageStatus = ref(route.query.status || '');
const reverseItemId = ref(route.query.item_id || '');
const risks = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const links = ref([]);
const linkTotal = ref(0);
const linkPage = ref(1);
const linkPageSize = ref(20);

const riskColumns = [
  { prop: 'item_id', label: '风险编码', width: 140 },
  { prop: 'item_name', label: '风险名称', minWidth: 200 },
  { prop: 'coverage_status', label: '覆盖状态', width: 100 },
  { prop: 'guard_count', label: '防护数', width: 80 },
];

const linkColumns = [
  { prop: 'source_item_name', label: '源用例', minWidth: 160 },
  { prop: 'target_item_name', label: '目标用例', minWidth: 160 },
  { prop: 'relation_type_name', label: '关系', width: 100 },
  { prop: 'direction', label: '方向', width: 100 },
];

function onTabChange(tab) {
  if (tab === 'graph') loadLinks();
}

function onFilterChange() {
  page.value = 1;
  loadRisks();
}

async function loadRisks() {
  loading.value = true;
  try {
    const data = await fetchRisks({
      coverage_status: coverageStatus.value || undefined,
      item_id: reverseItemId.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    risks.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function loadLinks() {
  loading.value = true;
  try {
    const data = await fetchRiskLinks({
      item_id: reverseItemId.value || undefined,
      page: linkPage.value,
      pageSize: linkPageSize.value,
    });
    links.value = data.list || [];
    linkTotal.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function goDetail(row) {
  router.push(`/fitness/assets/items/${encodeURIComponent(row.item_id)}`);
}

onMounted(loadRisks);
</script>

<style scoped>
.risk-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
