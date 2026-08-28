<template>
  <div class="novel-detail-shell">
    <header class="novel-detail-shell__header">
      <div class="novel-detail-shell__header-inner">
        <el-button link class="novel-detail-shell__back" @click="$emit('back')">
          ← 返回列表
        </el-button>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>
            <a href="#" @click.prevent="$emit('back')">小说中心</a>
          </el-breadcrumb-item>
          <el-breadcrumb-item>详情页</el-breadcrumb-item>
          <el-breadcrumb-item v-if="tabTitle">{{ tabTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="novel-detail-shell__actions">
          <el-button :icon="EditPen" @click="$emit('edit')">继续创作</el-button>
        </div>
      </div>
      <div class="novel-detail-hero">
        <div class="novel-detail-hero__cover">
          <el-image v-if="coverUrl" :src="coverUrl" fit="cover" class="novel-detail-hero__cover-img">
            <template #error>
              <div class="novel-detail-hero__cover-fallback">{{ coverLetter }}</div>
            </template>
          </el-image>
          <div v-else class="novel-detail-hero__cover-fallback">{{ coverLetter }}</div>
        </div>
        <div class="novel-detail-hero__meta">
          <h1 class="novel-detail-hero__title">{{ title || '未命名小说' }}</h1>
          <p v-if="intent" class="novel-detail-hero__intent">{{ intent }}</p>
          <div class="novel-detail-hero__tags">
            <el-tag v-if="genre" size="small">{{ genreLabel }}</el-tag>
            <el-tag v-if="novelType" size="small" effect="plain">{{ novelType }}</el-tag>
            <el-tag v-if="statusLabel" size="small" :type="statusType" effect="light">
              {{ statusLabel }}
            </el-tag>
          </div>
        </div>
      </div>
    </header>

    <div class="novel-detail-shell__body">
      <aside class="novel-detail-shell__nav">
        <slot name="tabs" />
      </aside>
      <div class="novel-detail-shell__content novel-fade-in">
        <slot />
      </div>
    </div>

    <slot name="footer" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { EditPen } from '@element-plus/icons-vue';
import { coverFallback, formatGenreLabel, progressLabel } from '../../../utils/novelMeta.js';

const props = defineProps({
  title: { type: String, default: '' },
  intent: { type: String, default: '' },
  genre: { type: String, default: '' },
  genreSubcategory: { type: String, default: '' },
  novelType: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  progressStatus: { type: String, default: '' },
  tabTitle: { type: String, default: '' },
});

defineEmits(['back', 'edit']);

const coverLetter = computed(() => coverFallback(props.title));
const genreLabel = computed(() => formatGenreLabel({
  genre: props.genre,
  genre_subcategory: props.genreSubcategory,
}));
const statusLabel = computed(() => progressLabel(props.progressStatus));
const statusType = computed(() => (props.progressStatus === 'completed' ? 'success' : 'warning'));
</script>

<style scoped>
.novel-detail-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 20px 0;
  gap: 12px;
}

.novel-detail-shell__header {
  flex-shrink: 0;
}

.novel-detail-shell__header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.novel-detail-shell__back {
  color: var(--novel-color-primary, #3d6b4f);
  font-weight: 600;
}

.novel-detail-shell__actions {
  margin-left: auto;
}

.novel-detail-hero {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border: var(--novel-border-subtle, 1px solid rgba(47, 138, 91, 0.12));
  border-radius: var(--novel-radius-base, 10px);
  background: var(--novel-gradient-hero);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
}

.novel-detail-hero__cover,
.novel-detail-hero__cover-img,
.novel-detail-hero__cover-fallback {
  width: 72px;
  height: 96px;
  border-radius: var(--novel-radius-sm, 6px);
  overflow: hidden;
  flex-shrink: 0;
}

.novel-detail-hero__cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--novel-gradient-cover);
  color: var(--novel-color-primary);
  font-size: 28px;
  font-weight: 600;
}

.novel-detail-hero__meta {
  min-width: 0;
  flex: 1;
}

.novel-detail-hero__title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30);
  line-height: 1.35;
}

.novel-detail-hero__intent {
  margin: 0 0 10px;
  padding-left: 10px;
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
  color: var(--novel-color-text, #2f3d34);
  font-size: 14px;
  line-height: 1.6;
}

.novel-detail-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.novel-detail-shell__body {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.novel-detail-shell__nav {
  min-width: 0;
  overflow-y: auto;
}

.novel-detail-shell__content {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

@media (max-width: 768px) {
  .novel-detail-shell__body {
    grid-template-columns: 1fr;
  }

  .novel-detail-hero__title {
    font-size: 18px;
  }
}
</style>
