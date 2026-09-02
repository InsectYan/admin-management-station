<template>
  <div v-loading="loading && !loadError" class="novel-detail-page">
    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="novel-detail-page__error"
    >
      <el-button link type="primary" @click="retryLoad">重试加载</el-button>
      <el-button link @click="goBackToList">返回列表</el-button>
    </el-alert>

    <NovelDetailShell
      v-if="!loadError"
      :title="basic.title"
      :intent="basic.creative_intent"
      :genre="basic.genre"
      :genre-subcategory="basic.genre_subcategory"
      :novel-type="basic.novel_type"
      :cover-url="basic.cover_url"
      :progress-status="basic.progress_status"
      :tab-title="tabMeta?.title"
      :fill-pane="currentTab === 7 || currentTab === 8"
      @back="goBackToList"
      @edit="goToWizard()"
      @plan="goToPlan"
      @autorun="goToPlanAutorun"
      @qa="goToQa"
    >
      <template #tabs>
        <NovelDetailTabs
          :tabs="DETAIL_TABS"
          :current-tab="currentTab"
          :filled-map="filledMap"
          @select="goToTab"
        />
      </template>

      <div v-if="currentTab < 7" class="novel-detail-page__ai">
        <el-button type="primary" plain @click="goToAiComplete">用 AI 补全本模块</el-button>
        <span class="novel-detail-page__ai-hint">打开对应设定步并展开林间写手，不自动发送</span>
      </div>

      <div
        class="novel-detail-page__pane"
        :class="{ 'is-studio': currentTab === 7 || currentTab === 8 }"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <DetailBasicInfo
          v-if="currentTab === 1"
          :form="basic"
          :meta="novelMeta"
        />
        <DetailWorldSetting
          v-else-if="currentTab === 2"
          :form="worldForm"
        />
        <DetailFactions
          v-else-if="currentTab === 3"
          :factions="factions"
          :characters="characters"
        />
        <DetailCharacters
          v-else-if="currentTab === 4"
          :characters="characters"
          :edges="characterEdges"
        />
        <DetailOutline
          v-else-if="currentTab === 5"
          :form="outlineForm"
        />
        <DetailContentOrg
          v-else-if="currentTab === 6"
          :form="contentForm"
        />
        <DetailChapterStudio
          v-else-if="currentTab === 7"
          :novel-id="novelId || novelMeta.id"
          :chapters="contentForm.chapters"
          :volumes="outlineForm.volumes"
          :characters="characters"
          :edges="characterEdges"
          :factions="factions"
          :world="worldForm"
          :initial-chapter-id="currentChapterId"
          :start-queue="startQueue"
          @chapter-change="onChapterChange"
          @progress-change="loadNovel"
          @queue-done="clearQueueQuery"
          @open-reader="goToReader"
        />
        <DetailReader
          v-else-if="currentTab === 8"
          :reader="reader"
          :error="readerError"
          @export="onExportReader"
          @edit-chapter="goToStudioChapter"
        />
      </div>

      <template #footer>
        <NovelDetailFooter
          :progress="progressMeta"
          :current-tab="currentTab"
          :tab-count="DETAIL_TABS.length"
          @prev="goPrevTab"
          @next="goNextTab"
        />
      </template>
    </NovelDetailShell>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import NovelDetailShell from '../components/novel/detail/NovelDetailShell.vue';
import NovelDetailTabs from '../components/novel/detail/NovelDetailTabs.vue';
import NovelDetailFooter from '../components/novel/detail/NovelDetailFooter.vue';
import DetailBasicInfo from '../components/novel/detail/DetailBasicInfo.vue';
import DetailWorldSetting from '../components/novel/detail/DetailWorldSetting.vue';
import DetailFactions from '../components/novel/detail/DetailFactions.vue';
import DetailCharacters from '../components/novel/detail/DetailCharacters.vue';
import DetailOutline from '../components/novel/detail/DetailOutline.vue';
import DetailContentOrg from '../components/novel/detail/DetailContentOrg.vue';
import DetailChapterStudio from '../components/novel/detail/DetailChapterStudio.vue';
import DetailReader from '../components/novel/detail/DetailReader.vue';
import { useNovelDetail } from '../composables/useNovelDetail.js';
import { fetchNovelReader } from '../services/novelService.js';
import { exportReader } from '../utils/novelExport.js';
import { ElMessage } from 'element-plus';

const {
  DETAIL_TABS,
  loading,
  loadError,
  novelId,
  currentTab,
  tabMeta,
  basic,
  worldForm,
  factions,
  characters,
  currentChapterId,
  characterEdges,
  outlineForm,
  contentForm,
  novelMeta,
  progressMeta,
  filledMap,
  retryLoad,
  goToTab,
  goPrevTab,
  goNextTab,
  goBackToList,
  goToWizard,
  goToAiComplete,
  goToPlan,
  goToPlanAutorun,
  onChapterChange,
  goToStudioChapter,
  goToReader,
  goToQa,
  startQueue,
  clearQueueQuery,
  loadNovel,
} = useNovelDetail();

const reader = ref({ volumes: [] });
const readerError = ref('');

async function loadReader() {
  const id = novelId.value || novelMeta.id;
  if (!id) return;
  readerError.value = '';
  try {
    reader.value = await fetchNovelReader(id) || { volumes: [] };
  } catch (err) {
    readerError.value = err.message || '加载全书失败';
    reader.value = { volumes: [] };
  }
}

function onExportReader(format) {
  if (!reader.value?.volumes?.length) {
    ElMessage.info('没有可导出的章节');
    return;
  }
  exportReader(reader.value, format);
  ElMessage.success(format === 'txt' ? '已导出 TXT' : '已导出 Markdown');
}

watch(
  () => currentTab.value,
  (tab) => {
    if (tab === 8) loadReader();
  },
  { immediate: true },
);

let touchStartX = 0;

function onTouchStart(e) {
  touchStartX = e.changedTouches?.[0]?.clientX || 0;
}

function onTouchEnd(e) {
  const endX = e.changedTouches?.[0]?.clientX || 0;
  const delta = endX - touchStartX;
  if (Math.abs(delta) < 56) return;
  if (delta < 0) goNextTab();
  else goPrevTab();
}
</script>

<style scoped>
.novel-detail-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  height: 100%;
}

.novel-detail-page__error {
  margin-bottom: 12px;
}

.novel-detail-page__ai {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.novel-detail-page__ai-hint {
  font-size: 12px;
  color: var(--novel-color-moon);
}

.novel-detail-page__pane {
  min-height: 0;
}

.novel-detail-page__pane.is-studio {
  flex: 1;
  height: 100%;
  overflow: hidden;
}
</style>
