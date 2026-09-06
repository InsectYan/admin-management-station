<template>
  <div class="novel-qa-page" v-loading="booting">
    <header class="novel-qa-page__header novel-card">
      <div class="novel-qa-page__header-top">
        <div>
          <el-button link @click="goBack">← 返回详情</el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>
              <a href="#" @click.prevent="goList">小说中心</a>
            </el-breadcrumb-item>
            <el-breadcrumb-item>
              <a href="#" @click.prevent="goDetail">详情</a>
            </el-breadcrumb-item>
            <el-breadcrumb-item>验收核检</el-breadcrumb-item>
          </el-breadcrumb>
          <h1 class="novel-qa-page__title">{{ novel?.title || '验收核检' }}</h1>
          <p class="novel-qa-page__subtitle">全流程设定与正文核检 · 可单模块或一次性检验</p>
        </div>
        <div class="novel-qa-page__header-actions">
          <el-checkbox v-model="useLlm">调用 AI 深检</el-checkbox>
          <el-button :loading="runningAll" type="primary" @click="runAll">一次性全检</el-button>
          <el-button :disabled="!novelId" @click="goDetail">打开详情</el-button>
        </div>
      </div>

      <div class="novel-qa-page__score-row">
        <div class="novel-qa-page__score">
          <strong>{{ displayScore }}</strong>
          <span>/ 100</span>
          <el-tag size="small" :type="healthTagType(report?.status)" effect="light">
            {{ healthStatusLabel(report?.status) }}
          </el-tag>
        </div>
        <p class="novel-qa-page__summary">{{ report?.summary || '尚未核检，点击「一次性全检」或右侧单模块检验' }}</p>
        <div class="novel-qa-page__module-pills">
          <button
            v-for="mod in moduleCards"
            :key="mod.key"
            type="button"
            class="novel-qa-pill"
            :class="`is-${mod.status}`"
            @click="focusModule(mod.key)"
          >
            <span>{{ mod.label }}</span>
            <em>{{ statusShort(mod.status) }}</em>
          </button>
        </div>
      </div>
    </header>

    <div class="novel-qa-page__body">
      <aside class="novel-qa-page__preview novel-card">
        <h3>设定速览</h3>
        <nav class="novel-qa-page__anchors">
          <a
            v-for="mod in QA_MODULE_META"
            :key="mod.key"
            href="#"
            :class="{ 'is-active': activeModule === mod.key }"
            @click.prevent="focusModule(mod.key)"
          >
            {{ mod.label }}
          </a>
        </nav>
        <div class="novel-qa-page__preview-body">
          <section v-if="activeModule === 'basic'">
            <h4>立意</h4>
            <NovelMarkdown :source="novel?.creative_intent" empty-text="未填写立意" />
            <h4>简介</h4>
            <NovelMarkdown :source="novel?.summary" empty-text="未填写简介" />
            <h4>小说概要</h4>
            <NovelMarkdown :source="novel?.story_overview" empty-text="未填写概要。建议写全书背景与主线长文。" />
          </section>
          <section v-else-if="activeModule === 'world'">
            <article v-for="block in worldBlocks" :key="block.title" class="novel-qa-preview-block">
              <strong>{{ block.title }}</strong>
              <NovelMarkdown compact :source="block.value" empty-text="未填写" />
            </article>
          </section>
          <section v-else-if="activeModule === 'factions'">
            <el-empty v-if="!factions.length" description="暂无门派" :image-size="48" />
            <article v-for="item in factions" :key="item.id" class="novel-qa-preview-block">
              <strong>{{ item.name || '未命名' }}</strong>
              <NovelMarkdown compact :source="item.description || item.rules" empty-text="" />
            </article>
          </section>
          <section v-else-if="activeModule === 'characters'" class="novel-qa-graph">
            <CharacterRelationGraph
              v-if="characters.length"
              :characters="characters"
              :edges="edges"
              readonly
            />
            <el-empty v-else description="暂无人物" :image-size="48" />
          </section>
          <section v-else-if="activeModule === 'outline'">
            <el-empty v-if="!outlineTitles.length" description="暂无大纲" :image-size="48" />
            <ul v-else class="novel-qa-outline-list">
              <li v-for="title in outlineTitles" :key="title">{{ title }}</li>
            </ul>
          </section>
          <section v-else-if="activeModule === 'content'">
            <el-empty v-if="!chapters.length" description="暂无章节目录" :image-size="48" />
            <ul v-else class="novel-qa-outline-list">
              <li v-for="ch in chapters" :key="ch.id">
                {{ ch.title || '未命名' }}
                <span class="is-muted">{{ ch.outline_ref ? `· ${ch.outline_ref}` : '· 未关联大纲' }}</span>
              </li>
            </ul>
          </section>
          <section v-else>
            <p class="is-muted">已写 {{ chapterWritten }}/{{ chapters.length }} 章。正文问题见右侧 findings；章级报告见下。</p>
            <ul v-if="chapterReports.length" class="novel-qa-outline-list">
              <li v-for="item in chapterReports" :key="item.chapter_id">
                {{ chapterTitleOf(item.chapter_id) }}
                <span class="is-muted">· {{ item.passed ? '通过' : item.summary || item.status }}</span>
                <el-button link type="primary" @click="runChapter(item.chapter_id)">重验</el-button>
              </li>
            </ul>
            <ul class="novel-qa-outline-list">
              <li v-for="item in continuityFindings" :key="item.id">
                {{ item.entity || item.message }}
              </li>
            </ul>
          </section>
        </div>
      </aside>

      <section class="novel-qa-page__panel novel-card">
        <div class="novel-qa-page__panel-head">
          <h3>智能质检</h3>
          <span class="is-muted">{{ filteredFindings.length }} 条问题</span>
        </div>

        <el-collapse v-model="openModules">
          <el-collapse-item
            v-for="mod in moduleCards"
            :key="mod.key"
            :name="mod.key"
          >
            <template #title>
              <div class="novel-qa-collapse-title">
                <span>{{ mod.label }}</span>
                <el-tag size="small" :type="moduleStatusIcon(mod.status)" effect="light">
                  {{ statusShort(mod.status) }} · {{ mod.count }}
                </el-tag>
                <el-button
                  size="small"
                  plain
                  :loading="runningModule === mod.key"
                  @click.stop="runModule(mod.key)"
                >
                  检验本模块
                </el-button>
              </div>
            </template>
            <p class="novel-qa-module-hint">{{ mod.hint }}</p>
            <el-empty
              v-if="!findingsOf(mod.key).length"
              description="本模块暂无问题"
              :image-size="40"
            />
            <article
              v-for="item in findingsOf(mod.key)"
              :key="item.id"
              class="novel-qa-finding"
              :class="{ 'is-ignored': isIgnored(item.id) }"
            >
              <header>
                <el-tag size="small" :type="severityTagType(item.severity)">{{ item.severity }}</el-tag>
                <strong>{{ item.entity || item.code }}</strong>
                <span v-if="item.chapter_id" class="is-muted">章 {{ item.chapter_id }}</span>
              </header>
              <NovelMarkdown compact :source="item.message" />
              <p v-if="item.evidence" class="novel-qa-finding__evidence">{{ item.evidence }}</p>
              <NovelMarkdown v-if="item.suggestion" compact :source="`建议：${item.suggestion}`" />
              <footer>
                <el-button
                  link
                  type="primary"
                  :disabled="isIgnored(item.id)"
                  @click="ignoreFinding(item.id)"
                >
                  忽略
                </el-button>
              </footer>
            </article>
          </el-collapse-item>
        </el-collapse>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import CharacterRelationGraph from '../components/novel/create/CharacterRelationGraph.vue';
import NovelMarkdown from '../components/novel/markdown/NovelMarkdown.vue';
import {
  fetchNovel,
  fetchNovelQa,
  fetchNovelSetting,
  ignoreNovelQaFinding,
  runNovelReview,
} from '../services/novelService.js';
import {
  QA_MODULE_META,
  healthStatusLabel,
  healthTagType,
  moduleStatusIcon,
  severityTagType,
} from '../utils/novelQa.js';

const route = useRoute();
const router = useRouter();

const novelId = computed(() => Number(route.params.id) || 0);
const novel = ref(null);
const setting = ref({});
const report = ref(null);
const booting = ref(false);
const runningAll = ref(false);
const runningModule = ref('');
const useLlm = ref(false);
const activeModule = ref('basic');
const openModules = ref(QA_MODULE_META.map((m) => m.key));

const characters = computed(() => setting.value?.characters || []);
const edges = computed(() => setting.value?.character_edges || []);
const factions = computed(() => setting.value?.factions || []);
const chapters = computed(() => setting.value?.chapters || []);
const chapterWritten = computed(() => Number(novel.value?.chapter_written) || 0);

const worldBlocks = computed(() => {
  const world = setting.value?.world || {};
  return [
    { title: '纪元', value: world.era },
    { title: '地理', value: world.geography },
    { title: '力量体系', value: world.power_system },
    { title: '社会规则', value: world.social_rules },
    { title: '科技', value: world.technology },
    { title: '历史', value: world.history_notes },
  ];
});

const outlineTitles = computed(() => {
  const volumes = setting.value?.outline?.volumes || setting.value?.volumes || [];
  const titles = [];
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (node?.title) titles.push(node.title);
      if (node?.groups) walk(node.groups);
      if (node?.sections) walk(node.sections);
    }
  };
  walk(volumes);
  return titles;
});

const ignoredIds = computed(() => report.value?.ignored_ids || []);

const moduleCards = computed(() => QA_MODULE_META.map((meta) => {
  const mod = report.value?.modules?.[meta.key];
  return {
    ...meta,
    status: mod?.status || 'unknown',
    count: mod?.count || findingsOf(meta.key).length,
  };
}));

const displayScore = computed(() => {
  const score = report.value?.score;
  return Number.isFinite(Number(score)) ? Number(score) : '—';
});

const filteredFindings = computed(() => (report.value?.findings || []).filter((f) => !ignoredIds.value.includes(f.id)));

const continuityFindings = computed(() => findingsOf('continuity').slice(0, 20));

const chapterReports = computed(() => {
  const map = report.value?.chapters || {};
  return Object.values(map)
    .filter((row) => row && row.chapter_id)
    .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
    .reverse()
    .slice(0, 12);
});

function chapterTitleOf(id) {
  const hit = chapters.value.find((ch) => String(ch.id) === String(id));
  return hit?.title || id;
}

async function runChapter(chapterId) {
  if (!novelId.value || !chapterId) return;
  try {
    await runNovelReview({
      novel_id: novelId.value,
      action: 'validate_chapter',
      chapter_id: chapterId,
      use_llm: useLlm.value,
      persist: true,
    });
    const qa = await fetchNovelQa(novelId.value);
    report.value = qa;
    ElMessage.success('本章已重验');
  } catch (err) {
    ElMessage.error(err.message || '章级核检失败');
  }
}

function findingsOf(moduleKey) {
  return (report.value?.findings || []).filter((f) => f.module === moduleKey && !ignoredIds.value.includes(f.id));
}

function isIgnored(id) {
  return ignoredIds.value.includes(id);
}

function statusShort(status) {
  if (status === 'pass') return '通过';
  if (status === 'warn') return '警告';
  if (status === 'fail') return '失败';
  if (status === 'info') return '提示';
  return '待检';
}

function focusModule(key) {
  activeModule.value = key;
  if (!openModules.value.includes(key)) openModules.value = [...openModules.value, key];
}

function goList() {
  router.push({ name: 'novel-list' });
}

function goDetail() {
  if (!novelId.value) return goList();
  router.push({ name: 'novel-detail', params: { id: String(novelId.value) } });
}

function goBack() {
  goDetail();
}

async function loadAll() {
  if (!novelId.value) return;
  booting.value = true;
  try {
    const [novelData, settingData, qaData] = await Promise.all([
      fetchNovel(novelId.value),
      fetchNovelSetting(novelId.value),
      fetchNovelQa(novelId.value),
    ]);
    novel.value = novelData;
    setting.value = settingData || {};
    report.value = qaData;
  } catch (err) {
    ElMessage.error(err.message || '加载核检失败');
  } finally {
    booting.value = false;
  }
}

async function runAll() {
  if (!novelId.value) return;
  runningAll.value = true;
  try {
    const data = await runNovelReview({
      novel_id: novelId.value,
      action: 'check_consistency',
      use_llm: useLlm.value,
    });
    report.value = data;
    ElMessage.success(data.passed ? '全检通过' : '全检完成，请查看问题');
  } catch (err) {
    ElMessage.error(err.message || '全检失败');
  } finally {
    runningAll.value = false;
  }
}

async function runModule(moduleKey) {
  if (!novelId.value) return;
  runningModule.value = moduleKey;
  focusModule(moduleKey);
  try {
    const data = await runNovelReview({
      novel_id: novelId.value,
      action: 'validate_module',
      module: moduleKey,
      use_llm: useLlm.value,
    });
    // 单模块返回后，刷新完整报告缓存
    const qa = await fetchNovelQa(novelId.value);
    report.value = qa || data;
    ElMessage.success(`「${QA_MODULE_META.find((m) => m.key === moduleKey)?.label}」检验完成`);
  } catch (err) {
    ElMessage.error(err.message || '模块检验失败');
  } finally {
    runningModule.value = '';
  }
}

async function ignoreFinding(findingId) {
  try {
    const data = await ignoreNovelQaFinding(novelId.value, findingId);
    report.value = { ...(report.value || {}), ...data };
    ElMessage.success('已忽略该条');
  } catch (err) {
    ElMessage.error(err.message || '忽略失败');
  }
}

watch(novelId, () => loadAll(), { immediate: false });

onMounted(loadAll);
</script>

<style scoped>
.novel-qa-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
}

.novel-qa-page__header,
.novel-qa-page__preview,
.novel-qa-page__panel {
  background: var(--novel-color-surface, rgba(255, 255, 255, 0.62));
  border: var(--novel-border-default, 1px solid rgba(47, 138, 91, 0.2));
  border-radius: var(--novel-radius-base, 10px);
  box-shadow: var(--novel-shadow-soft, 0 8px 24px rgba(31, 61, 44, 0.06));
}

.novel-qa-page__header {
  padding: 14px 16px 12px;
  flex-shrink: 0;
}

.novel-qa-page__header-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.novel-qa-page__header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.novel-qa-page__title {
  margin: 6px 0 2px;
  color: var(--novel-color-ink, #1f3d2c);
  font-size: 22px;
}

.novel-qa-page__subtitle,
.is-muted,
.novel-qa-page__summary,
.novel-qa-module-hint {
  color: var(--novel-color-muted, #5c6b62);
}

.novel-qa-page__score-row {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.novel-qa-page__score {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--novel-color-ink, #1f3d2c);
}

.novel-qa-page__score strong {
  font-size: 36px;
  color: var(--novel-color-primary, #2f8a5b);
  line-height: 1;
}

.novel-qa-page__module-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.novel-qa-pill {
  border: 1px solid rgba(47, 138, 91, 0.22);
  background: rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  padding: 4px 10px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  color: #2c4336;
}

.novel-qa-pill em {
  font-style: normal;
  font-size: 12px;
  opacity: 0.8;
}

.novel-qa-pill.is-pass { border-color: rgba(47, 138, 91, 0.45); }
.novel-qa-pill.is-warn { border-color: rgba(230, 162, 60, 0.65); background: rgba(253, 246, 236, 0.9); }
.novel-qa-pill.is-fail { border-color: rgba(245, 108, 108, 0.65); background: rgba(254, 240, 240, 0.9); }

.novel-qa-page__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.2fr);
  gap: 12px;
}

.novel-qa-page__preview,
.novel-qa-page__panel {
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.novel-qa-page__anchors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 12px;
}

.novel-qa-page__anchors a {
  color: #5c6b62;
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 6px;
}

.novel-qa-page__anchors a.is-active {
  background: rgba(47, 138, 91, 0.12);
  color: var(--novel-color-primary, #2f8a5b);
}

.novel-qa-preview-block {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.novel-qa-outline-list {
  margin: 0;
  padding-left: 18px;
  color: #2c4336;
}

.novel-qa-page__panel-head,
.novel-qa-collapse-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.novel-qa-collapse-title {
  width: 100%;
  padding-right: 8px;
}

.novel-qa-collapse-title .el-button {
  margin-left: auto;
}

.novel-qa-finding {
  border: 1px solid rgba(47, 138, 91, 0.16);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.45);
}

.novel-qa-finding.is-ignored {
  opacity: 0.45;
}

.novel-qa-finding header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.novel-qa-finding__evidence {
  margin: 4px 0;
  color: #6d8a82;
  font-size: 13px;
}

.novel-qa-graph {
  min-height: 240px;
}

@media (max-width: 960px) {
  .novel-qa-page__body {
    grid-template-columns: 1fr;
  }

  .novel-qa-page__header-top {
    flex-direction: column;
  }
}
</style>
