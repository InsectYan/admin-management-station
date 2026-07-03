<template>
  <PageShell title="样本集库" table-layout>
    <template #extra>
      <el-button type="primary" @click="openCreateSet">新建样本集</el-button>
    </template>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="接口样本集" name="http" />
      <el-tab-pane label="文本样本集" name="text" />
      <el-tab-pane label="注入样本集" name="inject" />
    </el-tabs>

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

    <el-dialog v-model="showSetForm" :title="setForm.id ? '编辑样本集' : '新建样本集'" width="480px">
      <el-form label-width="100px">
        <el-form-item label="类型">
          <el-select v-model="setForm.set_type" :disabled="!!setForm.id" style="width:160px">
            <el-option label="接口样本" value="http" />
            <el-option label="文本样本" value="text" />
            <el-option label="注入样本" value="inject" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="setForm.name" /></el-form-item>
        <el-form-item label="用例 ID"><el-input v-model="setForm.item_id" placeholder="可选" /></el-form-item>
        <el-form-item v-if="setForm.set_type === 'inject'" label="接口模板">
          <el-select v-model="setForm.api_template_id" filterable clearable placeholder="关联模板" style="width:100%">
            <el-option
              v-for="t in apiTemplates"
              :key="t.id"
              :label="`${t.name} (${t.template_code})`"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="setForm.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="tagsText" placeholder="逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSetForm = false">取消</el-button>
        <el-button type="primary" @click="saveSet">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="showItems" :title="activeSet?.name || '样本条目'" size="640px">
      <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <el-button type="primary" size="small" @click="openItemForm()">
          {{ addItemLabel }}
        </el-button>
        <template v-if="activeSet?.set_type === 'http' || !activeSet?.set_type">
          <el-button size="small" :loading="aiLoading" @click="aiGenerateSamples">AI 从 example 生成</el-button>
          <el-button size="small" @click="triggerImport">导入 JSON/CSV</el-button>
          <el-button size="small" :loading="csvEnrichLoading" @click="triggerCsvEnrich">CSV 智能补全</el-button>
        </template>
        <template v-if="activeSet?.set_type === 'text'">
          <el-button size="small" @click="openBulkText">批量添加文本</el-button>
        </template>
        <input ref="importInputRef" type="file" accept=".json,.csv,.txt" style="display:none" @change="onImportFile" />
        <input ref="csvEnrichInputRef" type="file" accept=".csv,.txt" style="display:none" @change="onCsvEnrichFile" />
      </div>
      <el-table v-loading="itemsLoading" :data="items" size="small" border>
        <el-table-column prop="sort_order" label="#" width="50" />
        <el-table-column label="内容" min-width="200">
          <template #default="{ row }">{{ formatInput(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link @click="openItemForm(row)">编辑</el-button>
            <el-button link type="danger" @click="removeItem(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <!-- HTTP 样本表单 -->
    <el-dialog v-model="showHttpItemForm" :title="itemForm.id ? '编辑样本' : '添加样本'" width="480px">
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
        <el-button @click="showHttpItemForm = false">取消</el-button>
        <el-button type="primary" @click="saveHttpItem">保存</el-button>
      </template>
    </el-dialog>

    <!-- 文本样本表单 -->
    <el-dialog v-model="showTextItemForm" :title="itemForm.id ? '编辑文本' : '添加文本'" width="480px">
      <el-form label-width="100px">
        <el-form-item label="文本内容">
          <el-input v-model="itemForm.text" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="字段 key">
          <el-input v-model="itemForm.field_key" placeholder="默认 text，对应用例 inject 的 field_key" />
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="itemForm.sort_order" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTextItemForm = false">取消</el-button>
        <el-button type="primary" @click="saveTextItem">保存</el-button>
      </template>
    </el-dialog>

    <!-- 注入样本表单 -->
    <el-dialog v-model="showInjectItemForm" :title="itemForm.id ? '编辑注入样本' : '添加注入样本'" width="520px">
      <el-form label-width="100px">
        <el-form-item label="注入 JSON">
          <el-input v-model="itemForm.injectJson" type="textarea" :rows="6" placeholder='{"message":"你好","coach_id":1}' />
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="itemForm.sort_order" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showInjectItemForm = false">取消</el-button>
        <el-button type="primary" @click="saveInjectItem">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量文本 -->
    <el-dialog v-model="showBulkText" title="批量添加文本" width="520px">
      <el-input v-model="bulkText" type="textarea" :rows="10" placeholder="每行一条文本样本" />
      <template #footer>
        <el-button @click="showBulkText = false">取消</el-button>
        <el-button type="primary" @click="saveBulkText">导入</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import {
  createSampleItem,
  createSampleSet,
  deleteSampleItem,
  deleteSampleSet,
  fetchApiTemplates,
  fetchSampleItems,
  fetchSampleSets,
  generateFitnessSamples,
  importSampleItems,
  enrichCsvSamples,
  updateSampleItem,
  updateSampleSet,
} from '@/services/fitnessService.js';

const loading = ref(false);
const itemsLoading = ref(false);
const aiLoading = ref(false);
const csvEnrichLoading = ref(false);
const sets = ref([]);
const items = ref([]);
const apiTemplates = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const activeTab = ref('http');
const showSetForm = ref(false);
const showItems = ref(false);
const showHttpItemForm = ref(false);
const showTextItemForm = ref(false);
const showInjectItemForm = ref(false);
const showBulkText = ref(false);
const activeSet = ref(null);
const importInputRef = ref(null);
const csvEnrichInputRef = ref(null);
const bulkText = ref('');
const setForm = reactive({
  id: null,
  name: '',
  item_id: '',
  set_type: 'http',
  api_template_id: null,
  description: '',
});
const tagsText = ref('');
const itemForm = reactive({
  id: null,
  path: '/health',
  method: 'GET',
  expect_status: 200,
  sort_order: 0,
  text: '',
  field_key: 'text',
  injectJson: '{}',
});

const sampleColumns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '样本集名称', minWidth: 160 },
  { prop: 'set_type', label: '类型', width: 90 },
  { prop: 'item_id', label: '关联用例', width: 140 },
  { prop: 'sample_count', label: '条数', width: 80 },
  { prop: 'tags', label: '标签', minWidth: 120 },
];

const addItemLabel = computed(() => {
  const t = activeSet.value?.set_type || 'http';
  if (t === 'text') return '添加文本';
  if (t === 'inject') return '添加注入组合';
  return '添加 HTTP 样本';
});

function formatInput(row) {
  const d = row.input_data || {};
  const t = activeSet.value?.set_type || 'http';
  if (t === 'text') {
    const key = Object.keys(d).find(k => k !== 'runner') || 'text';
    return String(d[key] ?? d.text ?? '').slice(0, 120);
  }
  if (t === 'inject') {
    return JSON.stringify(d).slice(0, 160);
  }
  return `${d.method || 'GET'} ${d.path || '?'} → ${d.expect_status ?? 200}`;
}

function onTabChange() {
  page.value = 1;
  load();
}

async function loadApiTemplates() {
  const data = await fetchApiTemplates({ pageSize: 100 });
  apiTemplates.value = data.list || [];
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchSampleSets({
      page: page.value,
      pageSize: pageSize.value,
      set_type: activeTab.value,
    });
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
  setForm.set_type = activeTab.value;
  setForm.api_template_id = null;
  setForm.description = '';
  tagsText.value = '';
  showSetForm.value = true;
}

function editSet(row) {
  setForm.id = row.id;
  setForm.name = row.name;
  setForm.item_id = row.item_id || '';
  setForm.set_type = row.set_type || 'http';
  setForm.api_template_id = row.api_template_id || null;
  setForm.description = row.description || '';
  tagsText.value = Array.isArray(row.tags) ? row.tags.join(',') : '';
  showSetForm.value = true;
}

async function saveSet() {
  const tags = tagsText.value
    ? tagsText.value.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const payload = {
    name: setForm.name,
    item_id: setForm.item_id || null,
    tags,
    set_type: setForm.set_type,
    description: setForm.description || null,
    api_template_id: setForm.set_type === 'inject' ? setForm.api_template_id : null,
  };
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
  const t = activeSet.value?.set_type || 'http';
  if (row) {
    const d = row.input_data || {};
    itemForm.id = row.id;
    itemForm.sort_order = row.sort_order ?? 0;
    if (t === 'text') {
      const key = Object.keys(d).find(k => k !== 'runner') || 'text';
      itemForm.text = d[key] ?? d.text ?? '';
      itemForm.field_key = key;
      showTextItemForm.value = true;
    } else if (t === 'inject') {
      itemForm.injectJson = JSON.stringify(d, null, 2);
      showInjectItemForm.value = true;
    } else {
      itemForm.path = d.path || '/health';
      itemForm.method = d.method || 'GET';
      itemForm.expect_status = d.expect_status ?? 200;
      showHttpItemForm.value = true;
    }
  } else {
    itemForm.id = null;
    itemForm.sort_order = items.value.length;
    if (t === 'text') {
      itemForm.text = '';
      itemForm.field_key = 'text';
      showTextItemForm.value = true;
    } else if (t === 'inject') {
      itemForm.injectJson = '{}';
      showInjectItemForm.value = true;
    } else {
      itemForm.path = '/health';
      itemForm.method = 'GET';
      itemForm.expect_status = 200;
      showHttpItemForm.value = true;
    }
  }
}

async function saveHttpItem() {
  const payload = {
    sort_order: itemForm.sort_order,
    input_data: {
      runner: 'http',
      path: itemForm.path,
      method: itemForm.method,
      expect_status: itemForm.expect_status,
    },
  };
  await persistItem(payload);
  showHttpItemForm.value = false;
}

async function saveTextItem() {
  const key = itemForm.field_key || 'text';
  const payload = {
    sort_order: itemForm.sort_order,
    input_data: { runner: 'text', [key]: itemForm.text },
  };
  await persistItem(payload);
  showTextItemForm.value = false;
}

async function saveInjectItem() {
  let data;
  try {
    data = JSON.parse(itemForm.injectJson || '{}');
  } catch {
    ElMessage.error('注入 JSON 无效');
    return;
  }
  const payload = {
    sort_order: itemForm.sort_order,
    input_data: { runner: 'inject', ...data },
  };
  await persistItem(payload);
  showInjectItemForm.value = false;
}

async function persistItem(payload) {
  if (itemForm.id) {
    await updateSampleItem(activeSet.value.id, itemForm.id, payload);
  } else {
    await createSampleItem(activeSet.value.id, payload);
  }
  ElMessage.success('已保存');
  await openItems(activeSet.value);
  await load();
}

function openBulkText() {
  bulkText.value = '';
  showBulkText.value = true;
}

async function saveBulkText() {
  const lines = bulkText.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) {
    ElMessage.warning('请输入至少一行文本');
    return;
  }
  const newItems = lines.map((line, i) => ({
    sort_order: items.value.length + i,
    input_data: { runner: 'text', text: line },
  }));
  await importSampleItems(activeSet.value.id, newItems);
  showBulkText.value = false;
  ElMessage.success(`已导入 ${newItems.length} 条文本`);
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

function triggerCsvEnrich() {
  csvEnrichInputRef.value?.click();
}

async function onCsvEnrichFile(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file || !activeSet.value) return;
  csvEnrichLoading.value = true;
  try {
    const csv_text = await file.text();
    const data = await enrichCsvSamples({
      csv_text,
      item_id: activeSet.value.item_id,
      scheme_id: 'TS-04-SET',
    });
    const rows = data.items || [];
    if (!rows.length) {
      ElMessage.warning('AI 未返回可导入样本');
      return;
    }
    await importSampleItems(activeSet.value.id, rows);
    ElMessage.success(`CSV 智能补全并导入 ${rows.length} 条`);
    await openItems(activeSet.value);
    await load();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || 'CSV 补全失败');
  } finally {
    csvEnrichLoading.value = false;
  }
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
    let rows;
    if (file.name.toLowerCase().endsWith('.csv')) {
      rows = parseCsvSamples(text);
    } else {
      rows = normalizeImportItems(JSON.parse(text));
    }
    if (!rows.length) {
      ElMessage.warning('未解析到有效样本');
      return;
    }
    await importSampleItems(activeSet.value.id, rows);
    ElMessage.success(`已导入 ${rows.length} 条样本`);
    await openItems(activeSet.value);
    await load();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '导入失败');
  }
}

onMounted(async () => {
  await loadApiTemplates();
  await load();
});
</script>
