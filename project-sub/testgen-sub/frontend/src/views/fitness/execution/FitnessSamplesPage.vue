<template>
  <PageShell title="样本集库" table-layout>
    <template #extra>
      <el-button type="primary" @click="openCreateSet">新建样本集</el-button>
    </template>
    <FitnessLabeledTable
      :data="sets"
      :columns="sampleColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    >
      <template #suffix>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link @click="openItems(row)">条目</el-button>
            <el-button link @click="editSet(row)">编辑</el-button>
            <el-button link type="danger" @click="removeSet(row)">删除</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>

    <el-dialog v-model="showSetForm" :title="setForm.id ? '编辑样本集' : '新建样本集'" width="440px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="setForm.name" /></el-form-item>
        <el-form-item label="用例 ID"><el-input v-model="setForm.item_id" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="tagsText" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSetForm = false">取消</el-button>
        <el-button type="primary" @click="saveSet">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="showItems" :title="activeSet?.name || '样本条目'" size="640px">
      <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <el-button type="primary" size="small" @click="openItemForm()">添加 HTTP 样本</el-button>
        <el-button size="small" :loading="aiLoading" @click="aiGenerateSamples">AI 从 example 生成</el-button>
        <el-button size="small" @click="triggerImport">导入 JSON/CSV</el-button>
        <input ref="importInputRef" type="file" accept=".json,.csv,.txt" style="display:none" @change="onImportFile" />
      </div>
      <el-table v-loading="itemsLoading" :data="items" size="small" border>
        <el-table-column prop="sort_order" label="#" width="50" />
        <el-table-column label="请求" min-width="200">
          <template #default="{ row }">{{ formatInput(row.input_data) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link @click="openItemForm(row)">编辑</el-button>
            <el-button link type="danger" @click="removeItem(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-dialog v-model="showItemForm" :title="itemForm.id ? '编辑样本' : '添加样本'" width="480px">
      <el-form label-width="100px">
        <el-form-item label="Path"><el-input v-model="itemForm.path" placeholder="/health" /></el-form-item>
        <el-form-item label="Method">
          <el-select v-model="itemForm.method" style="width:120px">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
          </el-select>
        </el-form-item>
        <el-form-item label="期望 Status"><el-input-number v-model="itemForm.expect_status" :min="100" :max="599" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="itemForm.sort_order" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showItemForm = false">取消</el-button>
        <el-button type="primary" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import {
  createSampleItem,
  createSampleSet,
  deleteSampleItem,
  deleteSampleSet,
  fetchSampleItems,
  fetchSampleSets,
  generateFitnessSamples,
  importSampleItems,
  updateSampleItem,
  updateSampleSet,
} from '@/services/fitnessService.js';

const loading = ref(false);
const itemsLoading = ref(false);
const aiLoading = ref(false);
const sets = ref([]);
const items = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showSetForm = ref(false);
const showItems = ref(false);
const showItemForm = ref(false);
const activeSet = ref(null);
const importInputRef = ref(null);
const setForm = reactive({ id: null, name: '', item_id: '' });
const tagsText = ref('');
const itemForm = reactive({
  id: null,
  path: '/health',
  method: 'GET',
  expect_status: 200,
  sort_order: 0,
});

const sampleColumns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '样本集名称', minWidth: 160 },
  { prop: 'item_id', label: '关联用例', width: 140 },
  { prop: 'sample_count', label: '条数', width: 80 },
  { prop: 'tags', label: '标签', minWidth: 120 },
];

function formatInput(d) {
  d = d || {};
  return `${d.method || 'GET'} ${d.path || '?'} → ${d.expect_status ?? 200}`;
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchSampleSets({ page: page.value, pageSize: pageSize.value });
    sets.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

function openCreateSet() {
  setForm.id = null;
  setForm.name = '';
  setForm.item_id = '';
  tagsText.value = '';
  showSetForm.value = true;
}

function editSet(row) {
  setForm.id = row.id;
  setForm.name = row.name;
  setForm.item_id = row.item_id || '';
  tagsText.value = Array.isArray(row.tags) ? row.tags.join(',') : '';
  showSetForm.value = true;
}

async function saveSet() {
  const tags = tagsText.value
    ? tagsText.value.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const payload = { name: setForm.name, item_id: setForm.item_id || null, tags };
  if (setForm.id) {
    await updateSampleSet(setForm.id, payload);
  } else {
    await createSampleSet(payload);
  }
  showSetForm.value = false;
  ElMessage.success('已保存');
  await load();
}

async function removeSet(row) {
  await ElMessageBox.confirm(`删除样本集「${row.name}」？`, '确认');
  await deleteSampleSet(row.id);
  ElMessage.success('已删除');
  await load();
}

async function openItems(row) {
  activeSet.value = row;
  showItems.value = true;
  itemsLoading.value = true;
  try {
    const data = await fetchSampleItems(row.id);
    items.value = data.items || [];
  } finally {
    itemsLoading.value = false;
  }
}

function openItemForm(row) {
  if (row) {
    const d = row.input_data || {};
    itemForm.id = row.id;
    itemForm.path = d.path || '/health';
    itemForm.method = d.method || 'GET';
    itemForm.expect_status = d.expect_status ?? 200;
    itemForm.sort_order = row.sort_order ?? 0;
  } else {
    itemForm.id = null;
    itemForm.path = '/health';
    itemForm.method = 'GET';
    itemForm.expect_status = 200;
    itemForm.sort_order = items.value.length;
  }
  showItemForm.value = true;
}

async function saveItem() {
  const payload = {
    sort_order: itemForm.sort_order,
    input_data: {
      runner: 'http',
      path: itemForm.path,
      method: itemForm.method,
      expect_status: itemForm.expect_status,
    },
  };
  if (itemForm.id) {
    await updateSampleItem(activeSet.value.id, itemForm.id, payload);
  } else {
    await createSampleItem(activeSet.value.id, payload);
  }
  showItemForm.value = false;
  ElMessage.success('已保存');
  await openItems(activeSet.value);
  await load();
}

async function removeItem(row) {
  await ElMessageBox.confirm('删除该样本？', '确认');
  await deleteSampleItem(activeSet.value.id, row.id);
  await openItems(activeSet.value);
  await load();
}

async function aiGenerateSamples() {
  if (!activeSet.value) return;
  aiLoading.value = true;
  try {
    await generateFitnessSamples({
      action: 'from_example',
      sample_set_id: activeSet.value.id,
      item_id: activeSet.value.item_id,
      scheme_id: 'TS-04-SET',
      persist: true,
    });
    ElMessage.success('AI 样本已生成');
    await openItems(activeSet.value);
    await load();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '生成失败');
  } finally {
    aiLoading.value = false;
  }
}

function triggerImport() {
  importInputRef.value?.click();
}

function parseCsvSamples(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(s => s.trim().toLowerCase());
  const pathIdx = header.indexOf('path');
  const methodIdx = header.indexOf('method');
  const statusIdx = header.findIndex(h => h === 'expect_status' || h === 'status');
  const start = pathIdx >= 0 ? 1 : 0;
  return lines.slice(start).map((line, i) => {
    const cols = line.split(',').map(s => s.trim());
    const path = pathIdx >= 0 ? cols[pathIdx] : cols[0];
    const method = methodIdx >= 0 ? cols[methodIdx] : (cols[1] || 'GET');
    const expect_status = statusIdx >= 0 ? Number(cols[statusIdx]) : Number(cols[2]) || 200;
    return {
      sort_order: i,
      input_data: { runner: 'http', path, method: method.toUpperCase(), expect_status },
    };
  });
}

function normalizeImportItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, i) => {
    const input = row.input_data || row;
    return {
      sort_order: row.sort_order ?? i,
      input_data: {
        runner: input.runner || 'http',
        path: input.path || '/health',
        method: (input.method || 'GET').toUpperCase(),
        expect_status: input.expect_status ?? 200,
      },
    };
  });
}

async function onImportFile(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file || !activeSet.value) return;
  try {
    const text = await file.text();
    let items;
    if (file.name.toLowerCase().endsWith('.csv')) {
      items = parseCsvSamples(text);
    } else {
      items = normalizeImportItems(JSON.parse(text));
    }
    if (!items.length) {
      ElMessage.warning('未解析到有效样本');
      return;
    }
    await importSampleItems(activeSet.value.id, items);
    ElMessage.success(`已导入 ${items.length} 条样本`);
    await openItems(activeSet.value);
    await load();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '导入失败');
  }
}

onMounted(load);
</script>
