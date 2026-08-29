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
      <template v-if="showPlanDock" #dock>
        <AiFormDock
          :scenes="ORCHESTRATE_AI_SCENES"
          feature-key="orchestrate"
          session-title="开书计划"
          apply-label="执行下一步"
          apply-success=""
          :novel-id="novelId"
          :start-expanded="expandDock"
          :form-snapshot="orchestrateSnapshot"
          @apply="onApplyPlan"
        />
      </template>
      <template v-else-if="currentStep === 1" #dock>
        <AiFormDock
          :scenes="BASIC_AI_SCENES"
          feature-key="basic"
          session-title="基础信息"
          :novel-id="novelId"
          :start-expanded="expandDock"
          :form-snapshot="basicForm"
          @apply="onApplyBasic"
        />
      </template>
      <template v-else-if="currentStep === 2" #dock>
        <AiFormDock
          :scenes="WORLD_AI_SCENES"
          feature-key="world"
          session-title="世界观"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="worldSnapshot"
          @apply="onApplyWorld"
          @focus="onWorldFocus"
        />
      </template>
      <template v-else-if="currentStep === 3" #dock>
        <AiFormDock
          :scenes="characterScenes"
          feature-key="characters"
          session-title="人物"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="characterSnapshot"
          :context-hint="characterHint"
          @apply="onApplyCharacters"
        />
      </template>
      <template v-else-if="currentStep === 4" #dock>
        <AiFormDock
          :scenes="OUTLINE_AI_SCENES"
          feature-key="outline"
          session-title="大纲"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="outlineSnapshot"
          @apply="onApplyOutline"
        />
      </template>
      <template v-else-if="currentStep === 5" #dock>
        <AiFormDock
          :scenes="CONTENT_AI_SCENES"
          feature-key="content"
          session-title="内容组织"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="contentSnapshot"
          @apply="onApplyContent"
        />
      </template>

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
        :focus-path="worldFocusPath"
        @change="markDirty"
      />
      <StepCharacters
        v-else-if="currentStep === 3"
        :characters="characters"
        :edges="characterEdges"
        :active-id="characterActiveId"
        @update:active-id="characterActiveId = $event"
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
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import NovelCreateShell from '../components/novel/create/NovelCreateShell.vue';
import NovelCreateSteps from '../components/novel/create/NovelCreateSteps.vue';
import NovelCreateFooter from '../components/novel/create/NovelCreateFooter.vue';
import StepBasicInfo from '../components/novel/create/StepBasicInfo.vue';
import StepWorldSetting from '../components/novel/create/StepWorldSetting.vue';
import StepCharacters from '../components/novel/create/StepCharacters.vue';
import StepOutline from '../components/novel/create/StepOutline.vue';
import StepContentOrg from '../components/novel/create/StepContentOrg.vue';
import AiFormDock from '../components/novel/ai/AiFormDock.vue';
import { useNovelCreateWizard } from '../composables/useNovelCreateWizard.js';
import { BASIC_AI_SCENES, WORLD_AI_SCENES, OUTLINE_AI_SCENES, CONTENT_AI_SCENES, ORCHESTRATE_AI_SCENES, buildCharacterScenes } from '../utils/aiScenes.js';
import { applyBasicPatch, applyWorldPatch, applyCharacterPatch, applyOutlinePatch, applyChaptersPatch, flattenOutlineTitles } from '../utils/aiApplyPatch.js';
import { dispatchAiPlan } from '../services/aiService.js';

const {
  WIZARD_STEPS,
  basicForm,
  worldForm,
  characters,
  characterEdges,
  outlineForm,
  contentForm,
  currentStep,
  novelId,
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

const route = useRoute();
const router = useRouter();
const showPlanDock = computed(() => route.query.ai === 'plan');
const expandDock = computed(() => route.query.ai === '1' || route.query.ai === 'plan');

const worldFocusPath = ref('');
const characterActiveId = ref('');
const activeCharacter = computed(() => characters.value.find((row) => row.id === characterActiveId.value) || null);
const characterScenes = computed(() => buildCharacterScenes(activeCharacter.value));
const characterHint = computed(() => {
  if (!activeCharacter.value) return '';
  const name = activeCharacter.value.name || '未命名角色';
  return `正在补全：${name}`;
});
const worldSnapshot = computed(() => ({
  era: worldForm.era,
  geography: worldForm.geography,
  social_rules: worldForm.social_rules,
  power_system: worldForm.power_system,
  technology: worldForm.technology,
  history_notes: worldForm.history_notes,
  timeline: worldForm.timeline,
  basic: {
    title: basicForm.title,
    creative_intent: basicForm.creative_intent,
    summary: basicForm.summary,
    genre: basicForm.genre,
    genre_subcategory: basicForm.genre_subcategory,
    genre_path: basicForm.genre_path,
    theme_ids: basicForm.theme_ids,
    themes: basicForm.themes,
  },
}));

const characterSnapshot = computed(() => ({
  characters: characters.value.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    personality: String(row.personality || '').slice(0, 240),
    background: String(row.background || '').slice(0, 240),
    goal: String(row.goal || '').slice(0, 240),
    relations: String(row.relations || '').slice(0, 160),
  })),
  character_edges: characterEdges.value.map((row) => ({
    source: row.source,
    target: row.target,
    relation: row.relation,
    label: row.label,
  })),
  world: {
    era: worldForm.era,
    geography: worldForm.geography,
    power_system: worldForm.power_system,
  },
  basic: {
    title: basicForm.title,
    creative_intent: basicForm.creative_intent,
    summary: basicForm.summary,
    genre: basicForm.genre,
    themes: basicForm.themes,
  },
}));

const outlineSnapshot = computed(() => ({
  volumes: (outlineForm.volumes || []).map((vol) => ({
    id: vol.id,
    title: vol.title,
    word_target: vol.word_target,
    groups: (vol.groups || []).map((group) => ({
      id: group.id,
      title: group.title,
      word_target: group.word_target,
      sections: (group.sections || []).map((sec) => ({
        id: sec.id,
        title: sec.title,
        word_target: sec.word_target,
      })),
    })),
  })),
  characters: characters.value.map((row) => ({ name: row.name, role: row.role })),
  basic: {
    title: basicForm.title,
    creative_intent: basicForm.creative_intent,
    summary: basicForm.summary,
    length_id: basicForm.length_id,
    genre: basicForm.genre,
  },
}));

const contentSnapshot = computed(() => ({
  chapters: (contentForm.chapters || []).map((ch) => ({
    id: ch.id,
    title: ch.title,
    faction: ch.faction,
    order: ch.order,
    outline_ref: ch.outline_ref,
  })),
  outline_titles: flattenOutlineTitles(outlineForm.volumes),
  characters: characters.value.map((row) => ({ name: row.name, role: row.role })),
  basic: {
    title: basicForm.title,
    creative_intent: basicForm.creative_intent,
    summary: basicForm.summary,
  },
}));

const orchestrateSnapshot = computed(() => ({
  coverage: {
    basic: Boolean(String(basicForm.title || '').trim()),
    world: Boolean(worldForm.era || worldForm.power_system || worldForm.geography),
    characters: characters.value.length > 0,
    outline: (outlineForm.volumes || []).length > 0,
    content: (contentForm.chapters || []).length > 0,
  },
  basic: {
    title: basicForm.title,
    creative_intent: basicForm.creative_intent,
    summary: basicForm.summary,
  },
}));

function onApplyBasic(patch) {
  applyBasicPatch(basicForm, patch);
  markDirty();
}

function onApplyWorld(patch) {
  applyWorldPatch(worldForm, patch);
  markDirty();
}

function onApplyCharacters(patch, paths = []) {
  applyCharacterPatch(characters.value, characterEdges.value, patch, { paths });
  markDirty();
}

function onApplyOutline(patch, paths = []) {
  applyOutlinePatch(outlineForm, patch, { paths });
  markDirty();
}

function onApplyContent(patch, paths = []) {
  applyChaptersPatch(contentForm, patch, { paths });
  markDirty();
}

async function onApplyPlan(_patch, _paths, meta = {}) {
  if (!meta.sessionId) {
    ElMessage.error('没有计划会话');
    return;
  }
  try {
    const result = await dispatchAiPlan({
      plan_session_id: meta.sessionId,
      task_path: meta.taskPath || undefined,
      novel_id: novelId.value,
    });
    ElMessage.success('已执行，正在打开对应步骤');
    const query = {
      ...route.query,
      id: String(result.novel_id),
      step: String(result.step || 1),
      ai: '1',
      plan_session: String(result.plan_session_id),
    };
    router.replace({ query });
  } catch (err) {
    ElMessage.error(err.message || '执行失败');
  }
}

function onWorldFocus(path) {
  worldFocusPath.value = path;
}
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
