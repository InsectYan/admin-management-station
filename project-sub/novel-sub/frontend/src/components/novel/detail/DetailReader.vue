<template>
  <div class="novel-reader">
    <aside class="novel-reader__toc">
      <header class="novel-reader__toc-head">
        <h3>目录</h3>
        <span class="is-muted">{{ reader.word_count || 0 }} 字 · {{ reader.chapter_written || 0 }}/{{ reader.chapter_total || 0 }} 章</span>
      </header>
      <nav class="novel-reader__toc-list">
        <template v-for="(ch, index) in chapters" :key="ch.id">
          <strong
            v-if="ch.volumeTitle && ch.volumeTitle !== chapters[index - 1]?.volumeTitle"
            class="novel-reader__vol"
          >{{ ch.volumeTitle }}</strong>
          <button
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
        <el-button type="primary" plain @click="inspectOpen = true">小说检测</el-button>
        <el-button @click="$emit('export', 'md')">导出 Markdown</el-button>
        <el-button @click="$emit('export', 'txt')">导出 TXT</el-button>
      </header>
      <el-dialog v-model="inspectOpen" title="小说检测" width="460px">
        <p class="novel-reader__inspect-copy">
          粗略检测只查章节目录是否乱序、各章字数是否不够。全面检测在此之上，再按大纲和前面章节的关联检查每一章正文。
        </p>
        <template #footer>
          <el-button :loading="inspecting" @click="runInspect('rough')">粗略检测</el-button>
          <el-button type="primary" :loading="inspecting" @click="runInspect('full')">全面检测</el-button>
        </template>
      </el-dialog>
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
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import { createAnomalyReport } from '../../../services/novelService.js';

const props = defineProps({
  reader: { type: Object, default: () => ({ volumes: [] }) },
  novelId: { type: [Number, String], default: null },
  error: { type: String, default: '' },
});

defineEmits(['export', 'edit-chapter']);

const router = useRouter();
const inspectOpen = ref(false);
const inspecting = ref(false);
const activeId = ref('');

async function runInspect(mode) {
  if (!props.novelId) {
    ElMessage.error('缺少小说');
    return;
  }
  inspecting.value = true;
  try {
    const report = await createAnomalyReport(props.novelId, mode);
    inspectOpen.value = false;
    ElMessage.success(report?.summary || '检测完成');
    await router.push({ name: 'novel-anomaly-detail', params: { id: report.id } });
  } catch (err) {
    ElMessage.error(err.message || '检测失败');
  } finally {
    inspecting.value = false;
  }
}

const chapters = computed(() => {
  const list = [];
  for (const vol of props.reader.volumes || []) {
    for (const ch of vol.chapters || []) {
      list.push({ ...ch, volumeTitle: vol.title || '' });
    }
  }
  return list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
});

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

.novel-reader__inspect-copy {
  margin: 0;
  line-height: 1.6;
  color: var(--novel-color-text-secondary, #5c6b62);
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
