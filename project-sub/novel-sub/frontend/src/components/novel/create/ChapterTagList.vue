<template>
  <div class="novel-chapter-tags">
    <div class="novel-chapter-tags__toolbar">
      <el-button size="small" class="novel-wood-button" @click="$emit('add')">添加章节</el-button>
      <span class="novel-chapter-tags__hint">拖拽左侧手柄调整章节顺序</span>
    </div>

    <el-empty v-if="!chapters.length" description="暂无章节标签" />

    <div v-else ref="listRef" class="novel-chapter-tags__list">
      <div
        v-for="(ch, index) in chapters"
        :key="ch.id"
        class="novel-chapter-tag"
        :class="`novel-chapter-tag--${ch.faction}`"
      >
        <button type="button" class="novel-chapter-tag__drag" aria-label="拖拽排序">⋮⋮</button>
        <div class="novel-chapter-tag__order">{{ ch.order }}</div>
        <el-input v-model="ch.title" placeholder="章节标题" @input="$emit('change')" />
        <el-select v-model="ch.faction" style="width: 100px" @change="$emit('change')">
          <el-option
            v-for="f in CHAPTER_FACTION_OPTIONS"
            :key="f.value"
            :label="f.label"
            :value="f.value"
          />
        </el-select>
        <el-input
          v-model="ch.outline_ref"
          placeholder="关联大纲"
          style="width: 140px"
          @input="$emit('change')"
        />
        <div class="novel-chapter-tag__actions">
          <el-button link type="danger" @click="remove(index)">删除</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  nextTick, onMounted, onUnmounted, ref, watch,
} from 'vue';
import Sortable from 'sortablejs';
import { CHAPTER_FACTION_OPTIONS } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  chapters: { type: Array, required: true },
});

const emit = defineEmits(['change', 'add']);

const listRef = ref(null);
let sortableInstance = null;

function reindex() {
  props.chapters.forEach((ch, i) => {
    ch.order = i + 1;
  });
}

function remove(index) {
  props.chapters.splice(index, 1);
  reindex();
  emit('change');
}

function initSortable() {
  sortableInstance?.destroy();
  sortableInstance = null;
  if (!listRef.value || !props.chapters.length) return;

  sortableInstance = Sortable.create(listRef.value, {
    handle: '.novel-chapter-tag__drag',
    animation: 150,
    ghostClass: 'novel-chapter-tag--ghost',
    onEnd(evt) {
      if (evt.oldIndex == null || evt.newIndex == null) return;
      if (evt.oldIndex === evt.newIndex) return;
      const item = props.chapters.splice(evt.oldIndex, 1)[0];
      props.chapters.splice(evt.newIndex, 0, item);
      reindex();
      emit('change');
    },
  });
}

onMounted(() => {
  nextTick(initSortable);
});

onUnmounted(() => {
  sortableInstance?.destroy();
});

watch(
  () => props.chapters.length,
  () => nextTick(initSortable),
);
</script>

<style scoped>
.novel-chapter-tags__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.novel-chapter-tags__hint {
  font-size: 13px;
  color: var(--novel-color-moon);
}

.novel-chapter-tags__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.novel-chapter-tag {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--novel-radius-base);
  border: var(--novel-border-default);
  background: var(--novel-color-surface);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.novel-chapter-tag--ghost {
  opacity: 0.55;
  box-shadow: var(--novel-shadow-soft, 0 6px 20px rgba(61, 107, 79, 0.12));
}

.novel-chapter-tag--hero {
  border-left: 4px solid var(--novel-color-success);
}

.novel-chapter-tag--villain {
  border-left: 4px solid #c45656;
  background: rgba(255, 68, 68, 0.08);
}

.novel-chapter-tag--neutral {
  border-left: 4px solid var(--novel-color-moon);
}

.novel-chapter-tag__drag {
  border: none;
  background: transparent;
  color: var(--novel-color-text-muted, #8A968E);
  cursor: grab;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
}

.novel-chapter-tag__drag:active {
  cursor: grabbing;
}

.novel-chapter-tag__order {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--novel-color-primary);
  color: var(--novel-color-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.novel-chapter-tag__actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

@media (prefers-reduced-motion: reduce) {
  .novel-chapter-tag {
    transition: none;
  }
}
</style>
