<template>
  <section class="novel-detail-card novel-downstreams">
    <h3 class="novel-detail-card__title">下游视频项目</h3>
    <p v-if="error" class="is-muted">{{ error }}</p>
    <p v-else-if="!items.length" class="is-muted">还没有视频项目钉扎这个故事。</p>
    <ul v-else class="novel-downstreams__list">
      <li v-for="item in items" :key="item.video_project_id">
        <a :href="videoHref(item.video_project_id)">{{ item.name }}</a>
        <span>{{ typeLabel(item.content_type) }}</span>
        <span>钉扎 v{{ item.version }}</span>
        <span>{{ stageLabel(item.stage) }}</span>
      </li>
    </ul>
    <a class="novel-downstreams__more" :href="videoHref()">送去视频化</a>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { fetchStoryDesk } from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [ Number, String ], default: '' },
});

const items = ref([]);
const error = ref('');

const typeNames = { ai_comic: 'AI 漫剧' };
const stageNames = {
  input: '输入与绑定',
  script: '脚本',
  storyboard: '分镜',
  assets: '资产',
  generate: '生成',
  compose: '合成',
  preview: '预览',
  export: '导出',
};

function typeLabel(value) {
  return typeNames[value] || 'AI 视频';
}
function stageLabel(value) {
  if (!value) return '阶段未知';
  return stageNames[value] || value;
}
function videoHref(id) {
  const path = id ? `/media/cartoon/projects/${id}` : '/media/cartoon/projects';
  const port = window.location.port;
  if (!port || port === '5100') return path;
  return `http://${window.location.hostname}:5105${path}`;
}
async function load() {
  if (!props.novelId) return;
  error.value = '';
  try {
    const data = await fetchStoryDesk(props.novelId);
    items.value = data?.downstreams || [];
  } catch (err) {
    error.value = err.message || '下游项目暂时读不到';
    items.value = [];
  }
}

watch(() => props.novelId, load);
onMounted(load);
</script>

<style scoped>
.novel-downstreams { margin-top: 16px; }
.novel-downstreams__list {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}
.novel-downstreams__list li {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.novel-downstreams__more { color: var(--el-color-primary); }
</style>
