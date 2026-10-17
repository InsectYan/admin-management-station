<template>
  <PageShell title="漫剧项目">
    <template #extra>
      <el-button type="primary" @click="openCreate">新建项目</el-button>
    </template>

    <div class="cartoon-module">
      <el-table class="cartoon-project-table" v-loading="loading" :data="rows" @row-click="open">
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="来源小说" min-width="160">
          <template #default="{ row }">{{ novelTitle(row.source_novel_id) }}</template>
        </el-table-column>
        <el-table-column label="画面风格" min-width="120">
          <template #default="{ row }">{{ styleLabel(row.visual_style) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>
      <el-empty v-if="!loading && !rows.length" description="还没有漫剧项目" />
    </div>

    <el-dialog v-model="visible" title="新建漫剧" width="480px">
      <el-form label-position="top">
        <el-form-item label="项目名称">
          <el-input v-model="form.name" placeholder="例如 第一章试拍" />
        </el-form-item>
        <el-form-item label="来源小说">
          <el-select v-model="form.source_novel_id" filterable clearable placeholder="从小说平台选择" style="width: 100%">
            <el-option v-for="item in novels" :key="item.id" :label="item.title" :value="String(item.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="画面风格">
          <el-select v-model="form.visual_style" filterable placeholder="选择风格" style="width: 100%">
            <el-option v-for="item in styles" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="create">创建并进入</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';

const router = useRouter();
const rows = ref([]);
const novels = ref([]);
const styles = ref([]);
const loading = ref(false);
const saving = ref(false);
const visible = ref(false);
const form = reactive({ name: '', source_novel_id: '', visual_style: '' });

function styleLabel(value) {
  return styles.value.find(item => item.value === value)?.label || '—';
}
function novelTitle(id) {
  if (!id) return '—';
  return novels.value.find(item => String(item.id) === String(id))?.title || `小说 #${id}`;
}
async function load() {
  loading.value = true;
  try {
    const [projects, catalog, meta] = await Promise.all([
      request('/projects'),
      request('/novel-catalog').catch(() => []),
      request('/meta').catch(() => ({ visual_styles: [] })),
    ]);
    rows.value = projects || [];
    novels.value = catalog || [];
    styles.value = meta.visual_styles || [];
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  form.name = '';
  form.source_novel_id = '';
  form.visual_style = styles.value[0]?.value || '';
  visible.value = true;
}
async function create() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写项目名称');
    return;
  }
  saving.value = true;
  try {
    const row = await request('/projects', {
      method: 'post',
      data: {
        name: form.name.trim(),
        source_novel_id: form.source_novel_id || null,
        visual_style: form.visual_style || '',
      },
    });
    visible.value = false;
    router.push(`/projects/${row.id}`);
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
function open(row) { router.push(`/projects/${row.id}`); }
onMounted(load);
</script>

<style scoped>
.cartoon-project-table :deep(.el-table__body tr) {
  cursor: pointer;
}
</style>
