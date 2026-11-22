<template>
  <PageShell :title="detail.name || '枚举'" :loading="loading">
    <template #extra>
      <el-button type="primary" :disabled="!canMake()" @click="openCreate">新增</el-button>
    </template>
    <p class="cartoon-module__hint">
      <el-button link type="primary" @click="router.push('/skills/enums')">返回</el-button>
      {{ detail.description }}
    </p>
    <p class="cartoon-module__hint">改编码或名称后，已经引用它的项目和镜头会一起改过去。编号不能改。</p>
    <el-table :data="detail.items" empty-text="还没有数据">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column v-for="field in detail.fields" :key="field.key" :label="field.label" min-width="140">
        <template #default="{ row }">
          <span class="cartoon-enum-cell">{{ display(row, field) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="引用项" min-width="220">
        <template #default="{ row }">{{ referenceText(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="88" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :disabled="!canMake()" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" :title="editing ? '编辑' : '新增'" width="640px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="ID">
          <el-input :model-value="editing ? String(draft.id) : '保存后自动生成'" disabled />
        </el-form-item>
        <el-form-item v-for="field in detail.fields" :key="field.key" :label="field.label">
          <el-select v-if="field.type === 'select'" v-model="draft[field.key]" style="width: 100%">
            <el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-input v-else-if="field.type === 'textarea'" v-model="draft[field.key]" type="textarea" :rows="field.key === 'prompt' ? 6 : 3" />
          <el-input v-else v-model="draft[field.key]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canMake()" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { useRegionLoad } from '../lib/useRegionLoad.js';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const route = useRoute();
const router = useRouter();
const detail = ref({ name: '', description: '', fields: [], items: [] });
const dialog = ref(false);
const editing = ref(false);
const saving = ref(false);
const draft = reactive({});
const { loading, run } = useRegionLoad({ immediate: true });

function display(row, field) {
  if (field.type !== 'select') return row[field.key] || '—';
  return field.options?.find(option => option.value === row[field.key])?.label || row[field.key] || '—';
}
function referenceText(row) {
  const count = Number(row.references?.count || 0);
  const samples = row.references?.samples || [];
  if (!count) return '没有引用';
  if (!samples.length) return `${count} 处`;
  if (samples.length < count) return `${samples.join('、')} 等 ${count} 处`;
  return samples.join('、');
}
function fillDraft(row) {
  Object.keys(draft).forEach(key => delete draft[key]);
  draft.id = row?.id || null;
  (detail.value.fields || []).forEach(field => {
    const value = row?.[field.key];
    draft[field.key] = value == null || value === '' ? (field.key === 'bind' ? 'local' : '') : value;
  });
}
function openCreate() {
  editing.value = false;
  fillDraft(null);
  dialog.value = true;
}
function openEdit(row) {
  editing.value = true;
  fillDraft(row);
  dialog.value = true;
}
async function load() {
  await run(async () => {
    detail.value = await request(`/enums/${route.params.key}`);
  });
}
async function save() {
  const body = {};
  (detail.value.fields || []).forEach(field => {
    body[field.key] = draft[field.key];
  });
  saving.value = true;
  try {
    const path = editing.value ? `/enums/${route.params.key}/${draft.id}` : `/enums/${route.params.key}`;
    await request(path, { method: editing.value ? 'put' : 'post', data: body });
    dialog.value = false;
    ElMessage.success('已保存');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
watch(() => route.params.key, () => {
  load().catch(err => ElMessage.error(err.message));
}, { immediate: true });
</script>

<style scoped>
.cartoon-enum-cell {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
