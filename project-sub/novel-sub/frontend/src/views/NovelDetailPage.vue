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
      :novel-type="basic.novel_type"
      :cover-url="basic.cover_url"
      :progress-status="basic.progress_status"
      :tab-title="tabMeta?.title"
      @back="goBackToList"
      @edit="goToWizard()"
    >
      <template #tabs>
        <NovelDetailTabs
          :tabs="DETAIL_TABS"
          :current-tab="currentTab"
          :filled-map="filledMap"
          @select="goToTab"
        />
      </template>

      <div
        class="novel-detail-page__pane"
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
        <DetailCharacters
          v-else-if="currentTab === 3"
          :characters="characters"
          :edges="characterEdges"
        />
        <DetailOutline
          v-else-if="currentTab === 4"
          :form="outlineForm"
        />
        <DetailContentOrg
          v-else-if="currentTab === 5"
          :form="contentForm"
        />
      </div>

      <template #footer>
        <NovelDetailFooter
          :progress="progressMeta"
          :current-tab="currentTab"
          @prev="goPrevTab"
          @next="goNextTab"
          @edit="goToWizard()"
        />
      </template>
    </NovelDetailShell>
  </div>
</template>

<script setup>
import NovelDetailShell from '../components/novel/detail/NovelDetailShell.vue';
import NovelDetailTabs from '../components/novel/detail/NovelDetailTabs.vue';
import NovelDetailFooter from '../components/novel/detail/NovelDetailFooter.vue';
import DetailBasicInfo from '../components/novel/detail/DetailBasicInfo.vue';
import DetailWorldSetting from '../components/novel/detail/DetailWorldSetting.vue';
import DetailCharacters from '../components/novel/detail/DetailCharacters.vue';
import DetailOutline from '../components/novel/detail/DetailOutline.vue';
import DetailContentOrg from '../components/novel/detail/DetailContentOrg.vue';
import { useNovelDetail } from '../composables/useNovelDetail.js';

const {
  DETAIL_TABS,
  loading,
  loadError,
  currentTab,
  tabMeta,
  basic,
  worldForm,
  characters,
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
} = useNovelDetail();

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

.novel-detail-page__pane {
  min-height: 0;
}
</style>
