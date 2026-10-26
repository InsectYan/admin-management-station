<template>
  <PageShell title="模板中心">
    <div class="cartoon-module cartoon-template-filters">
      <el-select v-model="contentType" clearable placeholder="内容类型" style="width: 160px">
        <el-option v-for="item in CONTENT_TYPES" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
      <el-select v-model="stage" clearable placeholder="生产阶段" style="width: 160px">
        <el-option label="脚本" value="script" />
        <el-option label="分镜" value="storyboard" />
        <el-option label="镜头" value="shot" />
        <el-option label="字幕" value="subtitle" />
        <el-option label="配音" value="voice" />
      </el-select>
      <el-select v-model="industry" clearable placeholder="行业" style="width: 160px">
        <el-option label="教育" value="education" />
        <el-option label="故事" value="story" />
        <el-option label="品牌" value="brand" />
        <el-option label="音乐" value="music" />
        <el-option label="新闻" value="news" />
        <el-option label="旅游" value="travel" />
        <el-option label="健身" value="fitness" />
        <el-option label="助眠" value="sleep" />
      </el-select>
    </div>

    <el-empty v-if="!filtered.length" description="没有符合条件的模板" />
    <div v-else class="cartoon-template-grid">
      <el-card v-for="item in filtered" :key="item.id" class="cartoon-template-card" shadow="never">
        <h3>{{ item.name }}</h3>
        <p>{{ item.scene }}</p>
        <div class="cartoon-template-tags">
          <el-tag size="small">{{ item.content_label }}</el-tag>
          <el-tag size="small" effect="plain">{{ item.stage_label }}</el-tag>
          <el-tag size="small" effect="plain">{{ item.industry_label }}</el-tag>
        </div>
        <div class="cartoon-template-actions">
          <el-button size="small" plain @click="openPreview(item)">预览</el-button>
          <el-button size="small" type="primary" plain :disabled="!canMake()" @click="openCreate(item)">用这个模板</el-button>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="previewVisible" :title="preview?.name || '模板'" width="520px">
      <template v-if="preview">
        <p>{{ preview.scene }}</p>
        <p>默认配音：{{ preview.voice_label }}。默认字幕：{{ preview.subtitle_label }}。</p>
        <p v-if="preview.needs_package">这个模板需要故事包。创建项目后，到项目里绑定已发布版本。</p>
        <p v-else>文案写在视频项目里，不会新建叙事作品。</p>
        <ul>
          <li v-for="(shot, index) in preview.shots" :key="index">{{ shot.description }}</li>
        </ul>
        <p v-if="preview.pending.length">创建后待补：{{ preview.pending.join('、') }}</p>
      </template>
    </el-dialog>

    <el-dialog v-model="createVisible" title="从模板创建" width="480px">
      <el-form v-if="current" label-position="top">
        <el-form-item label="模板"><el-input :model-value="current.name" disabled /></el-form-item>
        <el-form-item label="项目名称">
          <el-input v-model="form.name" placeholder="作品标题" />
        </el-form-item>
        <el-form-item label="画面风格">
          <el-select v-model="form.visual_style" filterable placeholder="选择风格" style="width: 100%">
            <el-option v-for="item in styles" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <p class="cartoon-module__hint">{{ current.needs_package ? '创建后到项目里绑定故事包。' : '不会出现选择小说，也不会在叙事工作台新建作品。' }}</p>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
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
import { CONTENT_TYPES } from '../lib/contentTypes.js';

const router = useRouter();
const rows = ref([]);
const styles = ref([]);
const contentType = ref('');
const stage = ref('');
const industry = ref('');
const previewVisible = ref(false);
const preview = ref(null);
const createVisible = ref(false);
const current = ref(null);
const saving = ref(false);
const form = reactive({ name: '', visual_style: '' });

const filtered = computed(() => rows.value.filter(item => {
  if (contentType.value && item.content_type !== contentType.value) return false;
  if (stage.value && item.stage !== stage.value) return false;
  if (industry.value && item.industry !== industry.value) return false;
  return true;
}));

function openPreview(item) {
  preview.value = item;
  previewVisible.value = true;
}
function openCreate(item) {
  current.value = item;
  form.name = '';
  form.visual_style = styles.value[0]?.value || '';
  createVisible.value = true;
}
async function create() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写项目名称');
    return;
  }
  saving.value = true;
  try {
    const row = await request('/projects/from-template', {
      method: 'post',
      data: {
        template_id: current.value.id,
        name: form.name.trim(),
        visual_style: form.visual_style || '',
      },
    });
    createVisible.value = false;
    const path = `/projects/${row.project.id}`;
    router.push(row.needs_package ? path : `${path}?tab=2`);
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
async function load() {
  const [templates, meta] = await Promise.all([
    request('/video-templates'),
    request('/meta').catch(() => ({ visual_styles: [] })),
  ]);
  rows.value = templates || [];
  styles.value = meta.visual_styles || [];
}
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>

<style scoped>
.cartoon-template-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.cartoon-template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.cartoon-sub-root .cartoon-template-grid > .cartoon-template-card {
  position: relative;
  height: 100%;
  margin-top: 12px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.cartoon-template-card:hover {
  transform: translateY(-4px);
}
.cartoon-template-card :deep(.el-card__body) {
  padding-bottom: 56px;
}
.cartoon-template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.cartoon-template-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  background: linear-gradient(transparent, rgba(243, 248, 244, 0.92));
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.cartoon-template-card:hover .cartoon-template-actions {
  opacity: 1;
  pointer-events: auto;
}
.cartoon-template-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.cartoon-template-actions :deep(.el-button) {
  background-color: rgba(255, 255, 255, 0.72) !important;
  border-color: rgba(47, 138, 91, 0.22);
  color: #1f3d2c !important;
  border-radius: 6px;
}
.cartoon-template-actions :deep(.el-button--primary) {
  background-color: rgba(47, 138, 91, 0.22) !important;
  border-color: rgba(47, 138, 91, 0.42);
}
@media (hover: none) {
  .cartoon-template-actions {
    position: static;
    opacity: 1;
    margin-top: 12px;
    background: none;
    pointer-events: auto;
  }
}
</style>
