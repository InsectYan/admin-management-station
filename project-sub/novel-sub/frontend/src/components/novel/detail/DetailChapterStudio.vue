<template>
  <div
    ref="studioRef"
    class="novel-chapter-studio"
    :class="{ 'is-resizing': resizing }"
    :style="{ '--novel-chapter-tree-width': `${treeWidth}px` }"
  >
    <aside class="novel-chapter-studio__tree">
      <h3>章节目录</h3>
      <el-empty v-if="!chapters.length" description="请先在章节目录添加章节" :image-size="48" />
      <el-tree
        v-else
        :data="tree"
        node-key="id"
        :props="{ label: 'title', children: 'children' }"
        :expand-on-click-node="false"
        default-expand-all
        highlight-current
        :current-node-key="chapterId"
        @node-click="onTreeClick"
      >
        <template #default="{ data }">
          <span class="novel-chapter-studio__node" :class="`is-${data.kind}`">
            <span>{{ data.title || '未命名' }}</span>
            <em v-if="data.kind === 'chapter' && wordCountOf(data.id)">{{ wordCountOf(data.id) }}字</em>
          </span>
        </template>
      </el-tree>
    </aside>
    <div class="novel-chapter-studio__gutter">
      <button
        type="button"
        class="novel-chapter-studio__resizer"
        draggable="false"
        aria-label="拖动调整章节目录宽度"
        aria-orientation="vertical"
        :aria-valuemin="TREE_MIN_WIDTH"
        :aria-valuenow="treeWidth"
        @dragstart.prevent
        @pointerdown="onResizeStart"
        @pointermove="onResizeMove"
        @pointerup="onResizeEnd"
        @pointercancel="onResizeEnd"
        @keydown="onResizeKey"
      />
    </div>

    <section class="novel-chapter-studio__ref">
      <AiSceneTree
        :scenes="refScenes"
        :selected-id="refTab"
        @select="refTab = $event"
      />
      <div class="novel-chapter-studio__ref-body" :class="{ 'is-session': refTab === 'session' }">
        <AiFormDock
          v-if="chapterId"
          ref="dockRef"
          v-show="refTab === 'session'"
          class="novel-chapter-studio__dock"
          embedded
          start-expanded
          always-interactive
          :session-locked="!editable"
          lock-hint="打开「编辑」后才能对话、新开会话或应用到本章"
          :scenes="CHAPTER_AI_SCENES"
          feature-key="chapter"
          :session-title="sessionTitle"
          apply-label="应用到本章"
          apply-success="已写入正文，保存后才会入库"
          :novel-id="resolvedNovelId"
          :form-snapshot="chapterSnapshot"
          :storage-key="`novel-ai-chapter-${resolvedNovelId || 'draft'}`"
          @apply="onApplyBody"
        />
        <el-empty
          v-if="refTab === 'session' && !chapterId"
          description="从左侧目录进入单章后即可会话"
          :image-size="48"
        />
        <template v-if="refTab === 'relations'">
          <el-empty v-if="!characters.length" description="暂无人物关系" :image-size="48" />
          <CharacterRelationGraph
            v-else
            :characters="characters"
            :edges="edges"
            readonly
          />
        </template>
        <template v-else-if="refTab === 'factions'">
          <el-empty v-if="!factions.length" description="暂无门派组织" :image-size="48" />
          <article v-for="item in factions" :key="item.id" class="novel-chapter-studio__card">
            <strong>{{ item.name || '未命名组织' }}</strong>
            <span class="is-muted">{{ kindLabel(item.kind) }} · {{ alignmentLabel(item.alignment) }}</span>
            <NovelMarkdown compact :source="item.description" empty-text="" />
          </article>
        </template>
        <template v-else-if="refTab === 'outline'">
          <article class="novel-chapter-studio__card">
            <strong>{{ currentChapter?.title || '未选章节' }}</strong>
            <p v-if="currentChapter?.outline_ref" class="is-muted">关联大纲：{{ currentChapter.outline_ref }}</p>
            <NovelMarkdown compact :source="outlineNote" empty-text="本章尚未关联大纲小节" />
          </article>
        </template>
        <template v-else-if="refTab === 'world'">
          <article v-for="block in worldBlocks" :key="block.title" class="novel-chapter-studio__card">
            <strong>{{ block.title }}</strong>
            <NovelMarkdown compact :source="block.value" empty-text="未填写" />
          </article>
        </template>
      </div>
    </section>

    <section class="novel-chapter-studio__body">
      <header class="novel-chapter-studio__body-head">
        <div>
          <h3>{{ currentChapter?.title || '选择一章开始写' }}</h3>
          <span class="is-muted">{{ liveWordCount }} 字{{ dirty ? ' · 未保存' : '' }}</span>
        </div>
        <div class="novel-chapter-studio__nav">
          <el-switch
            :model-value="editable"
            inline-prompt
            active-text="编辑"
            inactive-text="浏览"
            :disabled="!chapterId"
            @change="onEditableChange"
          />
          <el-checkbox v-model="autoApplyAndSave" :disabled="!editable || queue.running">应用并保存</el-checkbox>
          <el-button
            :disabled="!editable || !chapterId || writingNext || queue.running"
            :loading="writingNext"
            @click="writeNextEmptyChapter"
          >
            写下一空章
          </el-button>
          <el-button
            :disabled="!chapterId || writingNext || queue.running || reviewingChapter"
            :loading="reviewingChapter"
            @click="reviewCurrentChapter"
          >
            验证本章
          </el-button>
          <el-button
            :disabled="!chapterId || writingNext || queue.running"
            :loading="queue.running"
            @click="confirmAndRunQueue"
          >
            续写未完成章节
          </el-button>
          <el-button :disabled="queue.running" @click="$emit('open-reader')">全书预览</el-button>
          <el-button :disabled="!prevChapter" @click="goChapter(prevChapter?.id)">上一章</el-button>
          <el-button :disabled="!nextChapter" @click="goChapter(nextChapter?.id)">下一章</el-button>
          <el-button type="primary" :disabled="!editable || !chapterId || !dirty" :loading="saving" @click="saveBody()">
            保存正文
          </el-button>
        </div>
      </header>
      <div v-if="queue.running" class="novel-chapter-studio__queue">
        <span>续写 {{ queue.index }}/{{ queue.total }} · {{ queue.title || '空章' }}</span>
        <el-button size="small" :disabled="queue.paused" @click="pauseQueue">暂停</el-button>
      </div>
      <div
        v-if="chapterReview && String(chapterReview.chapter_id) === String(chapterId)"
        class="novel-chapter-studio__qa"
        :class="`is-${chapterReview.status || 'info'}`"
      >
        <div class="novel-chapter-studio__qa-head">
          <strong>本章核检</strong>
          <el-tag size="small" :type="qaTagType(chapterReview.status)" effect="light">
            {{ chapterReview.passed ? '通过' : chapterReview.summary || '未通过' }}
          </el-tag>
          <span class="is-muted">{{ chapterReviewFindings.length }} 条</span>
          <el-button link type="primary" @click="goNovelQa">打开验收台</el-button>
          <el-button link @click="chapterReview = null">收起</el-button>
        </div>
        <ul v-if="chapterReviewFindings.length" class="novel-chapter-studio__qa-list">
          <li v-for="item in chapterReviewFindings.slice(0, 6)" :key="item.id">
            <el-tag size="small" :type="qaSeverityType(item.severity)">{{ item.severity }}</el-tag>
            <span>{{ item.message }}</span>
          </li>
        </ul>
        <p v-else class="is-muted">未发现阻断问题</p>
      </div>
      <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
      <el-empty v-else-if="!chapterId" description="从左侧目录进入单章" />
      <template v-else>
        <el-input
          v-if="editable"
          v-model="draft"
          type="textarea"
          resize="none"
          class="novel-chapter-studio__editor"
          placeholder="本章正文，支持 Markdown。离开本章或点保存才会写入。"
          @input="onDraftInput"
        />
        <div v-else class="novel-chapter-studio__preview">
          <NovelMarkdown :source="draft" empty-text="尚未撰写。打开「编辑」后可手写或用林间写手生成。" />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import AiSceneTree from '../ai/AiSceneTree.vue';
import AiFormDock from '../ai/AiFormDock.vue';
import CharacterRelationGraph from '../create/CharacterRelationGraph.vue';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import {
  fetchChapterBody,
  fetchChapterMeta,
  fetchEmptyChapters,
  runNovelReview,
  saveChapterBody,
} from '../../../services/novelService.js';
import { CHAPTER_AI_SCENES } from '../../../utils/aiScenes.js';
import { buildChapterTree, neighborChapters, firstChapterId, firstEmptyChapterId } from '../../../utils/chapterTree.js';
import { countBodyWords } from '../../../utils/countBodyWords.js';
import { factionAlignmentLabel, factionKindLabel } from '../../../utils/novelDetail.js';

const props = defineProps({
  novelId: { type: [Number, String], default: null },
  chapters: { type: Array, default: () => [] },
  volumes: { type: Array, default: () => [] },
  characters: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  factions: { type: Array, default: () => [] },
  world: { type: Object, default: () => ({}) },
  initialChapterId: { type: String, default: '' },
  startQueue: { type: Boolean, default: false },
});

const emit = defineEmits(['chapter-change', 'progress-change', 'queue-done', 'open-reader']);
const route = useRoute();
const router = useRouter();

const TREE_MIN_WIDTH = 230;
const REF_MIN_WIDTH = 280;
const BODY_MIN_WIDTH = 280;
const GRID_GAP = 12;
const TREE_WIDTH_KEY = 'novel-chapter-tree-width';
const WRITE_NEXT_PROMPT = '按本章标题和大纲写这一章正文，衔接上一章结尾，控制在目标字数附近。严格遵循本书「小说概要」与立意中的基调与主线（例如生活向/搞笑则少打斗、重日常互动）。不要复述上一章，也不要剧透下一章钩子以外的后文。';
const studioRef = ref(null);
const dockRef = ref(null);
const autoApplyAndSave = ref(true);
const writingNext = ref(false);
const reviewingChapter = ref(false);
const chapterReview = ref(null);
const queue = ref({
  running: false,
  paused: false,
  index: 0,
  total: 0,
  title: '',
});
const writeContext = ref({
  prev_ending: '',
  next_outline: '',
  word_target: 0,
});
const resizing = ref(false);
const dragState = ref(null);

function loadTreeWidth() {
  const n = Number(localStorage.getItem(TREE_WIDTH_KEY));
  if (Number.isFinite(n) && n >= TREE_MIN_WIDTH) return Math.min(560, Math.round(n));
  return TREE_MIN_WIDTH;
}

function persistTreeWidth(value) {
  localStorage.setItem(TREE_WIDTH_KEY, String(value));
}

function studioWidth() {
  return studioRef.value?.getBoundingClientRect().width || 0;
}

function maxTreeWidth() {
  const container = studioWidth();
  if (container <= 0) return 560;
  const reserved = REF_MIN_WIDTH + BODY_MIN_WIDTH + GRID_GAP * 2;
  return Math.max(TREE_MIN_WIDTH, Math.floor(container - reserved));
}

function clampTreeWidth(next) {
  return Math.min(maxTreeWidth(), Math.max(TREE_MIN_WIDTH, Math.round(next)));
}

const treeWidth = ref(loadTreeWidth());

function onResizeStart(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  resizing.value = true;
  dragState.value = { pointerId: event.pointerId };
}

function onResizeMove(event) {
  const drag = dragState.value;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const rect = studioRef.value?.getBoundingClientRect();
  if (!rect) return;
  const next = clampTreeWidth(event.clientX - rect.left);
  if (next === treeWidth.value) return;
  treeWidth.value = next;
}

function onResizeEnd(event) {
  const drag = dragState.value;
  if (!drag || event.pointerId !== drag.pointerId) return;
  try {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  } catch {
    /* already released */
  }
  dragState.value = null;
  resizing.value = false;
  persistTreeWidth(treeWidth.value);
}

function onResizeKey(event) {
  const step = event.shiftKey ? 32 : 16;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    treeWidth.value = clampTreeWidth(treeWidth.value - step);
    persistTreeWidth(treeWidth.value);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    treeWidth.value = clampTreeWidth(treeWidth.value + step);
    persistTreeWidth(treeWidth.value);
  } else if (event.key === 'Home') {
    event.preventDefault();
    treeWidth.value = TREE_MIN_WIDTH;
    persistTreeWidth(treeWidth.value);
  }
}

function syncTreeWidthToContainer() {
  treeWidth.value = clampTreeWidth(treeWidth.value);
}

onMounted(() => {
  syncTreeWidthToContainer();
  window.addEventListener('resize', syncTreeWidthToContainer);
});

onUnmounted(() => {
  window.removeEventListener('resize', syncTreeWidthToContainer);
  dragState.value = null;
  resizing.value = false;
});

function parseNovelId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const resolvedNovelId = computed(() => (
  parseNovelId(props.novelId) || parseNovelId(route.params.id)
));

const chapterId = ref('');
const draft = ref('');
const dirty = ref(false);
const editable = ref(false);
const saving = ref(false);
const loading = ref(false);
const loadError = ref('');
const metaMap = ref({});
const refTab = ref('session');

const liveWordCount = computed(() => countBodyWords(draft.value));
const sessionTitle = computed(() => (
  editable.value ? '单章正文 · 编辑' : '单章正文 · 浏览'
));

const refScenes = [
  {
    id: 'ref',
    title: '写作参考',
    children: [
      { id: 'session', title: '会话', icon: 'ChatLineSquare' },
      { id: 'relations', title: '人员关系', icon: 'Share' },
      { id: 'factions', title: '门派组织', icon: 'OfficeBuilding' },
      { id: 'outline', title: '本章大纲', icon: 'Reading' },
      { id: 'world', title: '世界观', icon: 'MapLocation' },
    ],
  },
];

const chapters = computed(() => props.chapters || []);
const currentChapter = computed(() => chapters.value.find((ch) => ch.id === chapterId.value) || null);
const tree = computed(() => buildChapterTree(props.volumes, chapters.value));
const neighbors = computed(() => neighborChapters(chapters.value, chapterId.value));
const prevChapter = computed(() => neighbors.value.prev);
const nextChapter = computed(() => neighbors.value.next);

const worldBlocks = computed(() => [
  { title: '时代背景', value: props.world?.era },
  { title: '力量体系', value: props.world?.power_system },
  { title: '地理环境', value: props.world?.geography },
].filter((block) => block.value));

const outlineNote = computed(() => {
  const ref = currentChapter.value?.outline_ref;
  if (!ref) return '';
  return `对照大纲节点「${ref}」写这一章，不要一次展开全书。`;
});

const chapterSnapshot = computed(() => ({
  chapter: currentChapter.value
    ? {
      id: currentChapter.value.id,
      title: currentChapter.value.title,
      faction: currentChapter.value.faction,
      outline_ref: currentChapter.value.outline_ref,
      order: currentChapter.value.order,
    }
    : null,
  body_excerpt: String(draft.value || '').slice(0, 800),
  prev_chapter: neighbors.value.prev
    ? {
      id: neighbors.value.prev.id,
      title: neighbors.value.prev.title,
      ending: writeContext.value.prev_ending || '',
    }
    : null,
  next_outline: writeContext.value.next_outline || '',
  word_target: writeContext.value.word_target || 0,
  words_written: liveWordCount.value,
  factions: (props.factions || []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    alignment: row.alignment,
  })),
  characters: (props.characters || []).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    faction_id: row.faction_id,
  })),
  character_edges: (props.edges || []).map((row) => ({
    source: row.source,
    target: row.target,
    relation: row.relation,
    label: row.label,
  })),
  world: {
    era: props.world?.era,
    power_system: props.world?.power_system,
  },
}));

function kindLabel(kind) {
  return factionKindLabel(kind);
}

function alignmentLabel(alignment) {
  return factionAlignmentLabel(alignment);
}

function wordCountOf(id) {
  if (id === chapterId.value) return liveWordCount.value;
  return metaMap.value[id]?.word_count || 0;
}

function onDraftInput() {
  dirty.value = true;
}

function enterEdit() {
  if (editable.value) return;
  editable.value = true;
  persistEditable(true);
}

async function refreshMeta() {
  if (!resolvedNovelId.value) return;
  try {
    const data = await fetchChapterMeta(resolvedNovelId.value);
    const list = data?.list || [];
    metaMap.value = Object.fromEntries(list.map((row) => [row.chapter_id, row]));
  } catch {
    metaMap.value = {};
  }
}

let bodyLoadSeq = 0;

async function loadBody(id) {
  if (!resolvedNovelId.value || !id) {
    draft.value = '';
    writeContext.value = { prev_ending: '', next_outline: '', word_target: 0 };
    return;
  }
  const seq = ++bodyLoadSeq;
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchChapterBody(resolvedNovelId.value, id);
    // 生成中途切章时，丢弃过期响应，避免空正文盖住刚写入的内容
    if (seq !== bodyLoadSeq || chapterId.value !== id) return;
    draft.value = data?.body || '';
    dirty.value = false;
    writeContext.value = {
      prev_ending: data?.prev_ending || '',
      next_outline: data?.next_outline || '',
      word_target: Number(data?.word_target) || 0,
    };
  } catch (err) {
    if (seq !== bodyLoadSeq || chapterId.value !== id) return;
    loadError.value = err.message || '加载本章正文失败';
    draft.value = '';
    writeContext.value = { prev_ending: '', next_outline: '', word_target: 0 };
  } finally {
    if (seq === bodyLoadSeq) loading.value = false;
  }
}

/** 按指定章节 id 落盘，不依赖当前浏览中的 chapterId */
async function persistChapterBody(targetChapterId, body, { silent = false } = {}) {
  if (!resolvedNovelId.value || !targetChapterId) return false;
  const text = String(body ?? '');
  saving.value = true;
  try {
    const data = await saveChapterBody(resolvedNovelId.value, targetChapterId, text);
    await refreshMeta();
    emit('progress-change');
    if (chapterId.value === targetChapterId) {
      draft.value = text;
      dirty.value = false;
      writeContext.value = {
        prev_ending: data?.prev_ending || writeContext.value.prev_ending,
        next_outline: data?.next_outline || writeContext.value.next_outline,
        word_target: Number(data?.word_target) || writeContext.value.word_target,
      };
    }
    if (!silent) ElMessage.success('本章已保存');
    return true;
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveBody({ silent = false } = {}) {
  if (!chapterId.value) return false;
  return persistChapterBody(chapterId.value, draft.value, { silent });
}

async function goChapter(id) {
  if (!id || id === chapterId.value) return;
  if (dirty.value) {
    const ok = await saveBody();
    if (!ok) return;
  }
  chapterId.value = id;
  emit('chapter-change', id);
  await loadBody(id);
}

async function awaitDockReadyForWrite() {
  enterEdit();
  refTab.value = 'session';
  // browse→edit 后 session-locked 要等 DOM/prop 刷新；切章后坞也可能刚挂载
  for (let i = 0; i < 8; i += 1) {
    await nextTick();
    if (editable.value && dockRef.value?.sendText) return;
  }
  throw new Error('写作面板未就绪');
}

function qaTagType(status) {
  if (status === 'pass') return 'success';
  if (status === 'warn') return 'warning';
  if (status === 'fail') return 'danger';
  return 'info';
}

function qaSeverityType(severity) {
  if (severity === 'error') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

const chapterReviewFindings = computed(() => (
  Array.isArray(chapterReview.value?.findings) ? chapterReview.value.findings : []
));

function goNovelQa() {
  const id = resolvedNovelId.value;
  if (!id) return;
  router.push({ name: 'novel-qa', params: { id: String(id) } });
}

/** 按绑定 chapter_id 核检；error 级未通过时抛 QA_FAILED，供队列门禁 */
async function reviewBoundChapter(boundChapterId, { gate = true } = {}) {
  if (!resolvedNovelId.value || !boundChapterId) return null;
  reviewingChapter.value = true;
  try {
    const data = await runNovelReview({
      novel_id: resolvedNovelId.value,
      action: 'validate_chapter',
      chapter_id: boundChapterId,
      use_llm: false,
      persist: true,
    });
    chapterReview.value = data;
    if (gate && data && data.passed === false) {
      const err = new Error(data.summary || '本章核检未通过');
      err.code = 'QA_FAILED';
      err.review = data;
      throw err;
    }
    return data;
  } finally {
    reviewingChapter.value = false;
  }
}

async function reviewCurrentChapter() {
  if (!chapterId.value || reviewingChapter.value || writingNext.value || queue.value.running) return;
  try {
    const data = await reviewBoundChapter(chapterId.value, { gate: false });
    if (data?.passed) ElMessage.success('本章核检通过');
    else ElMessage.warning(data?.summary || '本章核检有问题');
  } catch (err) {
    if (err?.code === 'QA_FAILED') {
      ElMessage.warning(err.message);
      return;
    }
    ElMessage.error(err.message || '核检失败');
  }
}

async function writeOneEmptyChapter(targetId) {
  if (!targetId) throw new Error('没有目标章节');
  // 生成全程绑定目标章节；结束后按此 id 落盘，避免中途切章写到别的章
  const boundChapterId = targetId;
  if (boundChapterId !== chapterId.value) {
    await goChapter(boundChapterId);
  }
  await awaitDockReadyForWrite();
  const ok = await dockRef.value.sendText(WRITE_NEXT_PROMPT);
  if (!ok) throw new Error('生成失败');
  const patch = await dockRef.value?.applyPending?.();
  if (!patch || typeof patch.body !== 'string' || !patch.body.trim()) {
    throw new Error('模型没有写出本章正文（本地模型常见于 JSON 被截断）。可点「写下一空章」或续写重试本章，已保存的章节不会被覆盖。');
  }
  const saved = await persistChapterBody(boundChapterId, patch.body, { silent: true });
  if (!saved) throw new Error('保存失败');
  // 写完即核检，绑定同一 chapter_id；error 则抛出让队列暂停
  try {
    await reviewBoundChapter(boundChapterId, { gate: true });
  } catch (err) {
    if (err?.code === 'QA_FAILED') throw err;
    ElMessage.warning(err.message || '核检暂时不可用，已跳过门禁');
  }
}

async function writeNextEmptyChapter() {
  if (!editable.value || writingNext.value || queue.value.running || !chapterId.value) return;
  const targetId = firstEmptyChapterId(chapters.value, wordCountOf, chapterId.value);
  if (!targetId) {
    ElMessage.info('没有未写章节');
    return;
  }
  writingNext.value = true;
  try {
    await writeOneEmptyChapter(targetId);
    ElMessage.success('已写入、保存并核检通过');
    const nextEmpty = firstEmptyChapterId(chapters.value, wordCountOf, chapterId.value);
    if (nextEmpty && nextEmpty !== chapterId.value) {
      await goChapter(nextEmpty);
    }
  } catch (err) {
    if (err?.code === 'QA_FAILED') {
      ElMessage.warning(`已保存，但核检未通过：${err.message}。可在下方查看或打开验收台。`);
    } else {
      ElMessage.error(err.message || '写下一空章失败');
    }
  } finally {
    writingNext.value = false;
  }
}

function pauseQueue() {
  queue.value.paused = true;
}

async function confirmAndRunQueue() {
  if (queue.value.running || writingNext.value) return;
  const id = resolvedNovelId.value;
  if (!id) return;
  let list = [];
  try {
    const data = await fetchEmptyChapters(id);
    list = data?.list || [];
  } catch (err) {
    ElMessage.error(err.message || '读取空章失败');
    emit('queue-done');
    return;
  }
  if (!list.length) {
    ElMessage.info('没有未写章节');
    emit('queue-done');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将连续写入 ${list.length} 个空章，写完自动核检；遇 error 级问题会暂停。不会覆盖已有正文。`,
      '续写未完成章节',
      { confirmButtonText: '开始续写', cancelButtonText: '取消' },
    );
  } catch {
    emit('queue-done');
    return;
  }
  enterEdit();
  queue.value = {
    running: true,
    paused: false,
    index: 0,
    total: list.length,
    title: '',
  };
  for (let i = 0; i < list.length; i += 1) {
    if (queue.value.paused) break;
    const item = list[i];
    queue.value.index = i + 1;
    queue.value.title = item.title || '';
    try {
      await writeOneEmptyChapter(item.chapter_id);
    } catch (err) {
      queue.value.running = false;
      if (err?.code === 'QA_FAILED') {
        ElMessage.warning(`「${queue.value.title}」已保存但核检未通过，队列已暂停。前面已写章节保留。`);
      } else {
        ElMessage.error(`「${queue.value.title}」${err.message || '失败'}，已停止。前面已保存的章节保留。`);
      }
      emit('queue-done');
      return;
    }
  }
  const paused = queue.value.paused;
  queue.value.running = false;
  queue.value.paused = false;
  ElMessage.success(paused ? '已暂停，已写章节已保留' : '未完成章节已写完');
  emit('queue-done');
}

function onTreeClick(data) {
  if (data?.kind === 'chapter') goChapter(data.id);
}

function editStorageKey() {
  return `novel-chapter-editable:${resolvedNovelId.value || 'draft'}`;
}

function persistEditable(value) {
  sessionStorage.setItem(editStorageKey(), value ? '1' : '0');
}

async function onEditableChange(next) {
  if (next) {
    editable.value = true;
    persistEditable(true);
    return;
  }
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('有未保存的正文。关闭编辑前要先保存吗？', '关闭编辑', {
        distinguishCancelAndClose: true,
        confirmButtonText: '保存并浏览',
        cancelButtonText: '不保存',
      });
      const ok = await saveBody();
      if (!ok) return;
    } catch (action) {
      if (action === 'cancel') {
        dirty.value = false;
        await loadBody(chapterId.value);
      } else {
        return;
      }
    }
  }
  editable.value = false;
  persistEditable(false);
}

function onApplyBody(patch) {
  const text = patch?.body;
  if (typeof text !== 'string' || !text.trim()) {
    ElMessage.info('这一轮没有可应用的正文');
    return;
  }
  enterEdit();
  draft.value = text;
  dirty.value = true;
}

watch(
  resolvedNovelId,
  (id) => {
    editable.value = id ? sessionStorage.getItem(`novel-chapter-editable:${id}`) === '1' : false;
  },
  { immediate: true },
);

watch(
  () => [resolvedNovelId.value, props.chapters, props.initialChapterId],
  async () => {
    await refreshMeta();
    const next = props.initialChapterId
      || chapterId.value
      || firstChapterId(props.chapters);
    if (next && next !== chapterId.value) {
      chapterId.value = next;
      emit('chapter-change', next);
      return;
    }
    if (chapterId.value) await loadBody(chapterId.value);
  },
  { immediate: true, deep: false },
);

watch(chapterId, (id) => {
  if (id) loadBody(id);
});

watch(
  () => props.startQueue,
  async (start) => {
    if (start) {
      await nextTick();
      await confirmAndRunQueue();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.novel-chapter-studio {
  display: flex;
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.novel-chapter-studio.is-resizing,
.novel-chapter-studio.is-resizing :deep(*) {
  cursor: col-resize;
  user-select: none;
}

.novel-chapter-studio__tree,
.novel-chapter-studio__ref,
.novel-chapter-studio__body {
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

.novel-chapter-studio__tree {
  flex: 0 0 var(--novel-chapter-tree-width, 230px);
  width: var(--novel-chapter-tree-width, 230px);
  max-width: var(--novel-chapter-tree-width, 230px);
  min-width: 0;
}

.novel-chapter-studio__gutter {
  flex: 0 0 0;
  width: 0;
  margin-left: -12px;
  position: relative;
  z-index: 4;
  align-self: stretch;
}

.novel-chapter-studio__resizer {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: -6px;
  width: 12px;
  z-index: 4;
  padding: 0;
  border: none;
  border-radius: 6px;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

.novel-chapter-studio__resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background 0.2s ease;
}

.novel-chapter-studio__resizer:hover::after,
.novel-chapter-studio__resizer:focus-visible::after,
.novel-chapter-studio.is-resizing .novel-chapter-studio__resizer::after {
  background: var(--novel-color-primary, #2f8a5b);
}

.novel-chapter-studio__resizer:focus-visible {
  outline: none;
}

.novel-chapter-studio__ref {
  flex: 0.95 1 0;
  min-width: 0;
}

.novel-chapter-studio__body {
  flex: 1.25 1 0;
  min-width: 0;
}

.novel-chapter-studio__tree h3,
.novel-chapter-studio__body-head h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-chapter-studio__tree :deep(.el-tree) {
  flex: 1;
  min-height: 0;
  background: transparent;
  overflow: auto;
}

.novel-chapter-studio__node {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.novel-chapter-studio__node em {
  font-style: normal;
  font-size: 11px;
  color: var(--novel-color-moon);
}

.novel-chapter-studio__ref-body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.novel-chapter-studio__ref-body.is-session {
  overflow: hidden;
  gap: 0;
}

.novel-chapter-studio__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.56);
}

.novel-chapter-studio__body-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.novel-chapter-studio__queue {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--novel-color-deep, #2a3a30);
  background: var(--novel-color-primary-muted, rgba(47, 138, 91, 0.08));
  border-radius: 8px;
  flex-shrink: 0;
}

.novel-chapter-studio__qa {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(47, 138, 91, 0.18);
  background: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.novel-chapter-studio__qa.is-fail {
  border-color: rgba(245, 108, 108, 0.45);
  background: rgba(245, 108, 108, 0.1);
}

.novel-chapter-studio__qa.is-warn {
  border-color: rgba(230, 162, 60, 0.5);
  background: rgba(230, 162, 60, 0.12);
}

.novel-chapter-studio__qa-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.novel-chapter-studio__qa-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.novel-chapter-studio__qa-list li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  color: #2c4336;
}

.novel-chapter-studio__nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.novel-chapter-studio__editor,
.novel-chapter-studio__preview {
  flex: 1;
  min-height: 160px;
}

.novel-chapter-studio__preview {
  overflow: auto;
  padding: 10px 12px;
  border-radius: var(--novel-radius-sm, 6px);
  background: rgba(255, 255, 255, 0.56);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
}

.novel-chapter-studio__editor :deep(.el-textarea) {
  height: 100%;
}

.novel-chapter-studio__editor :deep(textarea) {
  height: 100%;
  min-height: 160px;
  font-family: inherit;
  line-height: 1.7;
}

.novel-chapter-studio__dock {
  flex: 1;
  min-height: 0;
  height: 100%;
  position: relative;
  z-index: 1;
  pointer-events: auto;
}

.is-muted {
  font-size: 12px;
  color: var(--novel-color-moon);
}

@media (max-width: 1100px) {
  .novel-chapter-studio {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .novel-chapter-studio__tree,
  .novel-chapter-studio__ref,
  .novel-chapter-studio__body {
    flex: none;
    width: auto;
    max-width: none;
    min-width: 0;
  }

  .novel-chapter-studio__gutter {
    display: none;
  }

  .novel-chapter-studio__ref-body.is-session {
    min-height: 360px;
  }
}
</style>
