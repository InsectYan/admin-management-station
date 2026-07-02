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
        <div ref="graphRef" class="risk-graph" v-loading="loading" />
      </el-tab-pane>
      <el-tab-pane label="覆盖缺口" name="gap">
        <el-button link type="primary" @click="router.push('/fitness/insights/analysis/risk-gap')">查看分析视图</el-button>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Graph } from '@antv/g6';
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
const graphRef = ref(null);
let graphInstance = null;

const riskColumns = [
  { prop: 'item_id', label: '风险编码', width: 140 },
  { prop: 'item_name', label: '风险名称', minWidth: 200 },
  { prop: 'coverage_status', label: '覆盖状态', width: 100 },
  { prop: 'guard_count', label: '防护数', width: 80 },
];

function onTabChange(tab) {
  if (tab === 'graph') loadLinks();
}

function onFilterChange() {
  page.value = 1;
  loadRisks();
}

function destroyGraph() {
  if (graphInstance) {
    graphInstance.destroy();
    graphInstance = null;
  }
}

function renderGraph(linkRows) {
  destroyGraph();
  if (!graphRef.value) return;

  const nodeIds = new Set();
  const nodes = [];
  const edges = [];

  for (const row of linkRows) {
    const src = row.source_item_id || row.source_item_name;
    const tgt = row.target_item_id || row.target_item_name;
    if (!nodeIds.has(src)) {
      nodeIds.add(src);
      nodes.push({ id: src, data: { label: row.source_item_name || src } });
    }
    if (!nodeIds.has(tgt)) {
      nodeIds.add(tgt);
      nodes.push({ id: tgt, data: { label: row.target_item_name || tgt } });
    }
    edges.push({
      id: `${src}-${tgt}-${row.relation_type_name || ''}`,
      source: src,
      target: tgt,
      data: { label: row.relation_type_name || '' },
    });
  }

  if (!nodes.length) return;

  graphInstance = new Graph({
    container: graphRef.value,
    width: graphRef.value.clientWidth || 720,
    height: 360,
    data: { nodes, edges },
    layout: { type: 'force', preventOverlap: true, linkDistance: 120 },
    node: {
      style: { size: 28, fill: '#409eff', labelText: d => d.data.label, labelFill: '#303133', labelFontSize: 11 },
    },
    edge: {
      style: { stroke: '#c0c4cc', labelText: d => d.data.label, labelFontSize: 10 },
    },
    behaviors: [ 'drag-element', 'zoom-canvas', 'drag-canvas' ],
  });
  graphInstance.render();
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
      page: 1,
      pageSize: 100,
    });
    links.value = data.list || [];
    await nextTick();
    renderGraph(links.value);
  } finally {
    loading.value = false;
  }
}

function goDetail(row) {
  router.push(`/fitness/assets/items/${encodeURIComponent(row.item_id)}`);
}

onBeforeUnmount(destroyGraph);
onMounted(loadRisks);
</script>

<style scoped>
.risk-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.risk-graph {
  width: 100%;
  min-height: 360px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
</style>
