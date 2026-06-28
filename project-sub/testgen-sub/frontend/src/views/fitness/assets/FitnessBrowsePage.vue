<template>
  <PageShell title="分类浏览">
    <el-row :gutter="16">
      <el-col :span="8">
        <el-tree
          v-loading="loading"
          :data="treeData"
          node-key="id"
          highlight-current
          default-expand-all
          @node-click="onNodeClick"
        />
      </el-col>
      <el-col :span="16">
        <p v-if="selectedLabel" class="browse-label">当前: {{ selectedLabel }} ({{ total }} 项)</p>
        <FitnessLabeledTable
          :data="items"
          :columns="itemColumns"
          :page="page"
          :page-size="pageSize"
          :total="total"
          :loading="itemsLoading"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
          @change="reloadItems"
          @row-click="goDetail"
        />
      </el-col>
    </el-row>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchBrowseTree, fetchTestItems } from '@/services/fitnessService.js';

const router = useRouter();
const loading = ref(false);
const itemsLoading = ref(false);
const treeRaw = ref(null);
const selected = ref(null);
const selectedNode = ref(null);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const itemColumns = [
  { prop: 'item_id', label: '用例编码', width: 140 },
  { prop: 'item_name', label: '名称', minWidth: 200 },
  { prop: 'priority_name', label: '优先级', width: 90 },
  { prop: 'scheme_primary_name', label: '主方案', width: 120 },
];

const treeData = computed(() => {
  if (!treeRaw.value) return [];
  return treeRaw.value.dimensions.map(d => ({
    id: `d-${d.dimension_id}`,
    label: `${d.dimension_id} ${d.name}`,
    type: 'dimension',
    value: d.dimension_id,
    children: treeRaw.value.majors
      .filter(m => m.dimension_id === d.dimension_id)
      .map(m => ({
        id: `m-${m.category_major_id}`,
        label: m.name,
        type: 'major',
        value: m.category_major_id,
        children: treeRaw.value.minors
          .filter(n => n.category_major_id === m.category_major_id)
          .map(n => ({
            id: `n-${n.category_minor_id}`,
            label: `${n.name} (${n.item_count})`,
            type: 'minor',
            value: n.category_minor_id,
            count: n.item_count,
          })),
      })),
  }));
});

const selectedLabel = computed(() => selected.value?.label);

async function reloadItems() {
  if (!selectedNode.value) return;
  itemsLoading.value = true;
  try {
    const node = selectedNode.value;
    const params = { page: page.value, pageSize: pageSize.value };
    if (node.type === 'dimension') params.dimension_id = node.value;
    if (node.type === 'major') params.category_major_id = node.value;
    if (node.type === 'minor') params.category_minor_id = node.value;
    const data = await fetchTestItems(params);
    items.value = data.list;
    total.value = data.total;
  } finally {
    itemsLoading.value = false;
  }
}

async function onNodeClick(node) {
  selected.value = node;
  selectedNode.value = node;
  page.value = 1;
  await reloadItems();
}

function goDetail(row) {
  router.push(`/fitness/assets/items/${encodeURIComponent(row.item_id)}`);
}

onMounted(async () => {
  loading.value = true;
  treeRaw.value = await fetchBrowseTree();
  loading.value = false;
});
</script>

<style scoped>
.browse-label { margin-bottom: 12px; color: #606266; }
</style>
