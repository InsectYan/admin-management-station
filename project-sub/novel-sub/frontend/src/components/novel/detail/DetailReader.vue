<template>
  <div class="novel-reader">
    <aside class="novel-reader__toc">
      <header class="novel-reader__toc-head">
        <h3>目录</h3>
        <span class="is-muted">{{ reader.word_count || 0 }} 字 · {{ reader.chapter_written || 0 }}/{{ reader.chapter_total || 0 }} 章</span>
      </header>
      <nav class="novel-reader__toc-list">
        <template v-for="vol in reader.volumes || []" :key="vol.id">
          <strong v-if="vol.title" class="novel-reader__vol">{{ vol.title }}</strong>
          <button
            v-for="ch in vol.chapters || []"
            :key="ch.id"
            type="button"
            class="novel-reader__toc-item"
            :class="{ 'is-active': activeId === ch.id, 'is-empty': !ch.word_count }"
            @click="scrollTo(ch.id)"
          >
            {{ ch.title }}
          </button>
        </template>
      </nav>
    </aside>
    <div class="novel-reader__main">
      <header class="novel-reader__toolbar">
        <el-button @click="$emit('export', 'md')">导出 Markdown</el-button>
        <el-button @click="$emit('export', 'txt')">导出 TXT</el-button>
      </header>
      <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" />
      <el-empty v-else-if="!chapters.length" description="还没有章节目录" />
      <article v-else class="novel-reader__body">
        <section
          v-for="ch in chapters"
          :id="`reader-${ch.id}`"
          :key="ch.id"
          class="novel-reader__chapter"
        >
          <header class="novel-reader__chapter-head">
            <h2>{{ ch.title }}</h2>
            <el-button link type="primary" @click="$emit('edit-chapter', ch.id)">去这一章</el-button>
          </header>
          <NovelMarkdown :source="ch.body" empty-text="（未撰写）" />
        </section>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';

const props = defineProps({
  reader: { type: Object, default: () => ({ volumes: [] }) },
  error: { type: String, default: '' },
});

defineEmits(['export', 'edit-chapter']);

const activeId = ref('');

const chapters = computed(() => (
  (props.reader.volumes || []).flatMap((vol) => vol.chapters || [])
));

function scrollTo(id) {
  activeId.value = id;
  const el = document.getElementById(`reader-${id}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<style scoped>
.novel-reader {
  display: flex;
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.novel-reader__toc,
.novel-reader__main {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border-radius: var(--novel-radius-base, 10px);
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  padding: 12px;
}

.novel-reader__toc {
  flex: 0 0 220px;
  width: 220px;
}

.novel-reader__toc-head h3 {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-reader__toc-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.novel-reader__vol {
  margin: 8px 0 4px;
  font-size: 12px;
  color: var(--novel-color-moon, #7a8a80);
}

.novel-reader__toc-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--novel-color-deep, #2a3a30);
  cursor: pointer;
}

.novel-reader__toc-item:hover,
.novel-reader__toc-item.is-active {
  background: var(--novel-color-primary-muted, rgba(47, 138, 91, 0.08));
}

.novel-reader__toc-item.is-empty {
  color: var(--novel-color-moon, #7a8a80);
}

.novel-reader__main {
  flex: 1;
}

.novel-reader__toolbar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.novel-reader__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.novel-reader__chapter {
  padding: 8px 0 28px;
  border-bottom: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.1));
}

.novel-reader__chapter-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.novel-reader__chapter-head h2 {
  margin: 0;
  font-size: 18px;
  color: var(--novel-color-deep, #2a3a30);
}

.is-muted {
  font-size: 12px;
  color: var(--novel-color-moon, #7a8a80);
}
</style>
