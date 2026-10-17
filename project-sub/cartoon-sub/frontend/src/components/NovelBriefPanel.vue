<template>
  <section v-loading="loading" class="cartoon-novel-brief">
    <h3 class="cartoon-module__title">小说基础信息</h3>
    <p v-if="!novel && !loading" class="cartoon-module__hint">选择来源小说后，这里展示小说的基础信息。</p>
    <dl v-else-if="novel" class="cartoon-novel-brief__grid">
      <div>
        <dt>小说名称</dt>
        <dd>{{ novel.title || '未命名' }}</dd>
      </div>
      <div>
        <dt>类型</dt>
        <dd>{{ genreText }}</dd>
      </div>
      <div>
        <dt>篇幅</dt>
        <dd>{{ novel.novel_type || '未填写' }}</dd>
      </div>
      <div>
        <dt>题材</dt>
        <dd>{{ themeText }}</dd>
      </div>
      <div>
        <dt>目标读者</dt>
        <dd>{{ novel.target_audience || '未填写' }}</dd>
      </div>
      <div>
        <dt>作者</dt>
        <dd>{{ novel.author_name || '未填写' }}</dd>
      </div>
      <div>
        <dt>更新节奏</dt>
        <dd>{{ novel.update_cadence || '未填写' }}</dd>
      </div>
      <div>
        <dt>进度</dt>
        <dd>{{ progressText }}</dd>
      </div>
      <div class="is-wide">
        <dt>创作立意</dt>
        <dd>{{ novel.creative_intent || '未填写' }}</dd>
      </div>
      <div class="is-wide">
        <dt>小说简介</dt>
        <dd>{{ novel.summary || '未填写' }}</dd>
      </div>
      <div class="is-wide">
        <dt>小说概要</dt>
        <dd :class="{ 'is-clamped': !overviewOpen }">{{ novel.story_overview || '未填写' }}</dd>
        <el-button v-if="(novel.story_overview || '').length > 180" link type="primary" @click="overviewOpen = !overviewOpen">
          {{ overviewOpen ? '收起' : '展开全文' }}
        </el-button>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  novel: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});

const overviewOpen = ref(false);
const genreText = computed(() => [props.novel?.genre, props.novel?.genre_subcategory].filter(Boolean).join(' / ') || '未填写');
const themeText = computed(() => (props.novel?.themes || []).join('、') || '未填写');
const progressText = computed(() => {
  const novel = props.novel;
  if (!novel) return '未填写';
  const status = { ongoing: '连载中', completed: '已完结' }[novel.progress_status] || novel.progress_status || '未填写';
  const percent = novel.progress_percent == null ? '' : ` · ${novel.progress_percent}%`;
  const chapters = novel.chapter_total ? ` · ${novel.chapter_written || 0}/${novel.chapter_total} 章` : '';
  return `${status}${percent}${chapters}`;
});
</script>

<style scoped>
.cartoon-novel-brief {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(47, 138, 91, 0.16);
}
.cartoon-novel-brief__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 16px;
  margin: 0;
}
.cartoon-novel-brief__grid div { min-width: 0; }
.cartoon-novel-brief__grid .is-wide { grid-column: 1 / -1; }
.cartoon-novel-brief dt { color: #5c6b62; font-size: 12px; }
.cartoon-novel-brief dd { margin: 4px 0 0; white-space: pre-wrap; }
.cartoon-novel-brief dd.is-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 900px) {
  .cartoon-novel-brief__grid { grid-template-columns: 1fr 1fr; }
}
</style>
