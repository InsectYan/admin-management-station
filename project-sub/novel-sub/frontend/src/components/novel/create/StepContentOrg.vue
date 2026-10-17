<template>
  <div class="novel-step-content">
    <div class="novel-step-content__head">
      <p class="novel-step-content__hint">
        这里只编排章节标题、顺序、关联大纲和正/反/中立场次。门派、宗门等组织请到「门派组织」。
      </p>
      <div class="novel-step-content__style">
        <span class="novel-step-content__swatch novel-step-content__swatch--hero">正派</span>
        <span class="novel-step-content__swatch novel-step-content__swatch--villain">反派</span>
        <span class="novel-step-content__swatch novel-step-content__swatch--neutral">中立</span>
        <span class="novel-step-content__legend">左侧色条区分立场：正派为绿，反派为红，中立为雾青。拖拽左侧手柄调整顺序。</span>
        <el-button size="small" class="novel-wood-button" @click="$emit('add')">添加章节</el-button>
      </div>
    </div>
    <ChapterTagList
      :chapters="form.chapters"
      @change="$emit('change')"
    />
  </div>
</template>

<script setup>
import ChapterTagList from './ChapterTagList.vue';

defineProps({
  form: { type: Object, required: true },
});

defineEmits(['change', 'add']);
</script>

<style scoped>
.novel-step-content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.novel-step-content__head {
  flex-shrink: 0;
  margin-bottom: 12px;
  padding-bottom: 12px;
  background: var(--novel-color-bg, #f3f8f4);
}

.novel-step-content__hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--novel-color-moon);
}

.novel-step-content__style {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.novel-step-content__legend {
  flex: 1 1 220px;
  font-size: 13px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

.novel-step-content__swatch {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--novel-color-deep, #1f3d2c);
  background: var(--novel-color-surface, rgba(255, 255, 255, 0.62));
  border: var(--novel-border-default);
}

.novel-step-content__swatch--hero {
  border-left: 4px solid var(--novel-color-success);
}

.novel-step-content__swatch--villain {
  border-left: 4px solid #c45656;
  background: rgba(255, 68, 68, 0.08);
}

.novel-step-content__swatch--neutral {
  border-left: 4px solid var(--novel-color-moon);
}
</style>
