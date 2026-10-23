<template>
  <PageShell title="AI 视频">
    <template #extra>
      <el-button type="primary" :disabled="!canMake()" @click="openCreate">新建项目</el-button>
    </template>

    <div class="cartoon-module cartoon-summary">
      <span>生成中 {{ summary.generating }}</span>
      <a class="cartoon-summary__link" :href="opsHref">今日失败 {{ summary.failed }}</a>
      <span>待钉扎 {{ summary.unpinned }}</span>
      <span>今日新建 {{ summary.created_today }}</span>
      <span>近 24 小时成功率 {{ summary.success_rate_24h == null ? '—' : `${summary.success_rate_24h}%` }}</span>
    </div>

    <div class="cartoon-module">
      <el-table class="cartoon-project-table" v-loading="loading" :data="rows" @row-click="open">
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ typeLabel(row.content_type) }}</template>
        </el-table-column>
        <el-table-column label="来源小说" min-width="160">
          <template #default="{ row }">{{ novelTitle(row.source_novel_id) }}</template>
        </el-table-column>
        <el-table-column label="画面风格" min-width="120">
          <template #default="{ row }">{{ styleLabel(row.visual_style) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>
      <el-empty v-if="!loading && !rows.length" :description="loadError || '还没有视频项目'" />
    </div>

    <el-dialog v-model="visible" title="新建项目" width="480px">
      <el-form label-position="top">
        <el-form-item label="项目名称">
          <el-input v-model="form.name" placeholder="例如 第一章试拍" />
        </el-form-item>
        <el-form-item label="内容类型">
          <el-select v-model="form.content_type" style="width: 100%" @change="onType">
            <el-option label="漫剧" value="ai_comic" />
            <el-option label="短剧" value="ai_short" />
            <el-option label="科普" value="ai_science" />
            <el-option label="电商" value="ai_commerce" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isLocalType(form.content_type)" label="来源小说">
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
        <el-button type="primary" :disabled="!canMake()" :loading="saving" @click="create">创建并进入</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { isLocalType, typeLabel } from '../lib/contentTypes.js';

const router = useRouter();
const rows = ref([]);
const novels = ref([]);
const styles = ref([]);
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const visible = ref(false);
const summary = reactive({ generating: 0, failed: 0, unpinned: 0, created_today: 0, success_rate_24h: null });
const form = reactive({ name: '', content_type: 'ai_comic', source_novel_id: '', visual_style: '' });
const opsHref = computed(() => {
  const path = '/media/ops/overview';
  const port = window.location.port;
  if (!port || port === '5100') return path;
  return `http://${window.location.hostname}:5103${path}`;
});

function styleLabel(value) {
  return styles.value.find(item => item.value === value)?.label || '—';
}
function novelTitle(id) {
  if (!id) return '—';
  return novels.value.find(item => String(item.id) === String(id))?.title || `小说 #${id}`;
}
async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [projects, catalog, meta, dash] = await Promise.all([
      request('/projects'),
      request('/novel-catalog').catch(() => []),
      request('/meta').catch(() => ({ visual_styles: [] })),
      request('/summary').catch(() => null),
    ]);
    rows.value = projects || [];
    novels.value = catalog || [];
    styles.value = meta.visual_styles || [];
    if (dash) Object.assign(summary, dash);
  } catch (err) {
    rows.value = [];
    loadError.value = err.message || '项目列表加载失败';
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
}
function onType(value) {
  if (isLocalType(value)) form.source_novel_id = '';
}
function openCreate() {
  form.name = '';
  form.content_type = 'ai_comic';
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
        content_type: form.content_type,
        source_novel_id: isLocalType(form.content_type) ? null : (form.source_novel_id || null),
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
.cartoon-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}
.cartoon-summary__link {
  color: inherit;
  text-decoration: underline;
}
.cartoon-project-table :deep(.el-table__body tr) {
  cursor: pointer;
}
</style>
