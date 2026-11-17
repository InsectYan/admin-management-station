<template>
  <section class="cartoon-trace">
    <el-tabs v-model="part">
      <el-tab-pane v-for="item in parts" :key="item.key" :label="item.label" :name="item.key" />
    </el-tabs>
    <p v-if="loading" class="cartoon-module__hint">正在读取这次提示词记录。</p>
    <p v-else-if="!rows.length" class="cartoon-module__hint">这一段还没有提示词调用记录。重新生成提示词之后，这里会记下每次技能的输入和输出。</p>
    <template v-else>
      <div class="cartoon-trace__graph">
        <button
          v-for="(row, index) in rows"
          :key="row.id"
          type="button"
          class="cartoon-trace__node"
          :class="{ 'is-active': activeId === row.id }"
          @click="focus(row.id)"
        >
          <span>{{ index + 1 }}</span>{{ row.title || row.skill }}
        </button>
      </div>
      <div ref="pane" class="cartoon-trace__pane">
        <article
          v-for="row in rows"
          :id="`trace-${row.id}`"
          :key="`card-${row.id}`"
          class="cartoon-trace__card"
          :class="{ 'is-active': activeId === row.id }"
        >
          <h4>{{ row.title || '技能调用' }}</h4>
          <p>调用工具 {{ row.skill || '未记' }}</p>
          <div>
            <span>输入</span>
            <button type="button" class="cartoon-trace__clamp" @click="openDetail(row.title, '输入', row.input_text)">{{ row.input_text || '无' }}</button>
          </div>
          <div>
            <span>输出</span>
            <button type="button" class="cartoon-trace__clamp" @click="openDetail(row.title, '输出', row.output_text)">{{ row.output_text || '无' }}</button>
          </div>
        </article>
      </div>
    </template>
    <el-dialog v-model="dialog.open" :title="dialog.title" width="720px" append-to-body>
      <pre class="cartoon-trace__full">{{ dialog.text || '无' }}</pre>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { request } from '../services/apiConfig.js';

const props = defineProps({
  shotId: { type: [ String, Number ], default: '' },
});
const parts = [
  { key: 'video', label: '视频提示词' },
  { key: 'frame_start', label: '首帧提示词' },
  { key: 'frame_end', label: '尾帧提示词' },
];
const part = ref('video');
const loading = ref(false);
const traces = ref([]);
const activeId = ref(null);
const pane = ref(null);
const dialog = reactive({ open: false, title: '', text: '' });
const rows = computed(() => traces.value.filter(item => item.part === part.value));

async function load() {
  if (!props.shotId) {
    traces.value = [];
    return;
  }
  loading.value = true;
  try {
    const data = await request(`/shots/${props.shotId}/prompt-traces`);
    traces.value = Array.isArray(data?.list) ? data.list : [];
    activeId.value = rows.value[0]?.id || null;
  } catch (err) {
    traces.value = [];
  } finally {
    loading.value = false;
  }
}
function focus(id) {
  activeId.value = id;
  const box = pane.value;
  const card = box?.querySelector(`#trace-${id}`);
  if (!box || !card) return;
  box.scrollTop = Math.max(0, card.offsetTop - box.offsetTop);
}
function openDetail(title, field, text) {
  dialog.title = `${title || '技能调用'} · ${field}`;
  dialog.text = text || '';
  dialog.open = true;
}
watch(() => props.shotId, () => { load(); }, { immediate: true });
watch(part, () => { activeId.value = rows.value[0]?.id || null; });
</script>

<style scoped>
.cartoon-trace__graph { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
.cartoon-trace__node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(47, 138, 91, 0.35);
  background: #fff;
  color: #1f3d2c;
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
}
.cartoon-trace__node span {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e7f3ec;
  color: #1f3d2c;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.cartoon-trace__node.is-active { background: #2f8a5b; color: #fff; }
.cartoon-trace__node.is-active span { background: #fff; color: #2f8a5b; }
.cartoon-trace__pane {
  position: relative;
  max-height: 420px;
  overflow: auto;
  border: 1px solid #e6ebe7;
  border-radius: 8px;
  padding: 12px;
}
.cartoon-trace__card { padding: 12px 0; border-top: 1px solid #e6ebe7; }
.cartoon-trace__card:first-child { border-top: 0; padding-top: 0; }
.cartoon-trace__card.is-active h4 { color: #2f8a5b; }
.cartoon-trace__card h4,
.cartoon-trace__card p { margin: 0 0 8px; }
.cartoon-trace__card p { color: #5c6b62; }
.cartoon-trace__card > div { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; margin-top: 8px; }
.cartoon-trace__card > div > span { color: #5c6b62; line-height: 22px; }
.cartoon-trace__clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1f3d2c;
  text-align: left;
  white-space: pre-wrap;
  cursor: pointer;
  line-height: 22px;
  max-height: 44px;
}
.cartoon-trace__full {
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
