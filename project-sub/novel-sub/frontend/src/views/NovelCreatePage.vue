<template>
  <div v-loading="loading && !loadError" class="novel-create-page">
    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
      class="novel-create-page__error"
    >
      <el-button link type="primary" @click="retryLoad">重试加载</el-button>
      <el-button link @click="goBackToList">返回列表</el-button>
    </el-alert>

    <NovelCreateShell
      v-if="!loadError"
      :step-title="stepMeta?.title"
      @back="goBackToList"
    >
      <template #steps>
        <NovelCreateSteps
          :steps="WIZARD_STEPS"
          :current-step="currentStep"
          @select="goToStep"
        />
      </template>

      <StepBasicInfo
        v-if="currentStep === 1"
        :form="basicForm"
        @change="markDirty"
      />
      <StepWorldSetting
        v-else-if="currentStep === 2"
        :form="worldForm"
        @change="markDirty"
      />
      <StepCharacters
        v-else-if="currentStep === 3"
        :characters="characters"
        :edges="characterEdges"
        @change="markDirty"
        @update:edges="setCharacterEdges"
        @add="addCharacter"
        @remove="removeCharacter"
      />
      <StepOutline
        v-else-if="currentStep === 4"
        :form="outlineForm"
        @change="markDirty"
        @add-volume="addOutlineVolume"
      />
      <StepContentOrg
        v-else-if="currentStep === 5"
        :form="contentForm"
        @change="markDirty"
        @add="addChapter"
      />

      <template #footer>
        <NovelCreateFooter
          :saving="saving"
          :is-first-step="isFirstStep"
          :is-last-step="isLastStep"
          @save-draft="saveDraft"
          @prev="goPrev"
          @next="goNext"
          @finish="finishWizard"
        />
      </template>
    </NovelCreateShell>
  </div>
</template>

<script setup>
import NovelCreateShell from '../components/novel/create/NovelCreateShell.vue';
import NovelCreateSteps from '../components/novel/create/NovelCreateSteps.vue';
import NovelCreateFooter from '../components/novel/create/NovelCreateFooter.vue';
import StepBasicInfo from '../components/novel/create/StepBasicInfo.vue';
import StepWorldSetting from '../components/novel/create/StepWorldSetting.vue';
import StepCharacters from '../components/novel/create/StepCharacters.vue';
import StepOutline from '../components/novel/create/StepOutline.vue';
import StepContentOrg from '../components/novel/create/StepContentOrg.vue';
import { useNovelCreateWizard } from '../composables/useNovelCreateWizard.js';

const {
  WIZARD_STEPS,
  basicForm,
  worldForm,
  characters,
  characterEdges,
  outlineForm,
  contentForm,
  currentStep,
  saving,
  loading,
  loadError,
  isFirstStep,
  isLastStep,
  stepMeta,
  markDirty,
  saveDraft,
  goNext,
  goPrev,
  goToStep,
  finishWizard,
  goBackToList,
  retryLoad,
  addCharacter,
  removeCharacter,
  setCharacterEdges,
  addOutlineVolume,
  addChapter,
} = useNovelCreateWizard();
</script>

<style scoped>
.novel-create-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  height: 100%;
}

.novel-create-page__error {
  margin-bottom: 12px;
}
</style>
