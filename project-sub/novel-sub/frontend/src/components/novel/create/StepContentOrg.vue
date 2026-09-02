<template>
  <div class="novel-step-content">
    <p class="novel-step-content__hint">
      这里只编排章节标题、顺序、关联大纲和正/反/中立场次。门派、宗门等组织请到「门派组织」。
    </p>
    <ChapterTagList
      :chapters="form.chapters"
      @change="$emit('change')"
      @add="$emit('add')"
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
.novel-step-content__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--novel-color-moon);
}
</style>
