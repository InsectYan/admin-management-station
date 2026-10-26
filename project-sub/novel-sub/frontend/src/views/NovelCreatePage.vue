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
      <el-button link @click="goBack">{{ backLabel }}</el-button>
    </el-alert>

    <NovelCreateShell
      v-if="!loadError"
      :step-title="stepMeta?.title"
      :from-detail="cameFromDetail"
      :back-label="backLabel"
      @back="goBack"
      @home="goBackToList"
    >
      <template v-if="showPlanDock" #dock>
        <AiFormDock
          :scenes="ORCHESTRATE_AI_SCENES"
          feature-key="orchestrate"
          session-title="开书计划"
          apply-label="执行下一步"
          autorun-label="连续执行设定"
          apply-success=""
          :novel-id="novelId"
          :start-expanded="expandDock"
          :autorun-active="autorunActive"
          :session-locked="autorunActive"
          :form-snapshot="orchestrateSnapshot"
          @apply="onApplyPlan"
          @autorun="onAutorunPlan"
        />
      </template>
      <template v-else-if="currentStep === 1" #dock>
        <AiFormDock
          :scenes="BASIC_AI_SCENES"
          feature-key="basic"
          session-title="基础信息"
          :novel-id="novelId"
          :start-expanded="expandDock"
          :session-locked="autorunActive"
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
          :session-locked="autorunActive"
          :form-snapshot="worldSnapshot"
          @apply="onApplyWorld"
          @focus="onWorldFocus"
        />
      </template>
      <template v-else-if="currentStep === 3" #dock>
        <AiFormDock
          :scenes="factionScenes"
          feature-key="factions"
          session-title="门派组织"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="factionSnapshot"
          :context-hint="factionHint"
          :session-locked="autorunActive"
          @apply="onApplyFactions"
        />
      </template>
      <template v-else-if="currentStep === 4" #dock>
        <AiFormDock
          :scenes="characterScenes"
          feature-key="characters"
          session-title="人物"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="characterSnapshot"
          :context-hint="characterHint"
          :session-locked="autorunActive"
          @apply="onApplyCharacters"
        />
      </template>
      <template v-else-if="stepKey === 'style'" #dock>
        <AiFormDock
          :scenes="STYLE_AI_SCENES"
          feature-key="style"
          session-title="风格"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="basicForm"
          :session-locked="autorunActive"
          @apply="onApplyStyle"
        />
      </template>
      <template v-else-if="stepKey === 'plotline'" #dock>
        <AiFormDock
          :scenes="PLOTLINE_AI_SCENES"
          feature-key="plotline"
          session-title="剧情线"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="outlineSnapshot"
          :session-locked="autorunActive"
          @apply="onApplyPlotline"
        />
      </template>
      <template v-else-if="stepKey === 'outline'" #dock>
        <AiFormDock
          :scenes="OUTLINE_AI_SCENES"
          feature-key="outline"
          session-title="大纲"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="outlineSnapshot"
          :session-locked="autorunActive"
          @apply="onApplyOutline"
        />
      </template>
      <template v-else-if="stepKey === 'script'" #dock>
        <AiFormDock
          :scenes="SCRIPT_AI_SCENES"
          feature-key="script"
          session-title="剧本"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="outlineSnapshot"
          :session-locked="autorunActive"
          @apply="onApplyScript"
        />
      </template>
      <template v-else-if="stepKey === 'intent'" #dock>
        <AiFormDock
          :scenes="INTENT_AI_SCENES"
          feature-key="intent"
          session-title="叙事分镜"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="outlineSnapshot"
          :session-locked="autorunActive"
          @apply="onApplyIntent"
        />
      </template>
      <template v-else-if="stepKey === 'content'" #dock>
        <AiFormDock
          :scenes="CONTENT_AI_SCENES"
          feature-key="content"
          session-title="章节目录"
          :novel-id="novelId"
          :start-expanded="expandDock"
          require-novel-id
          :form-snapshot="contentSnapshot"
          :session-locked="autorunActive"
          @apply="onApplyContent"
        />
      </template>

      <template #steps>
        <el-alert
          v-if="autorunActive"
          type="info"
          :title="autorunLabel || '正在连续执行设定'"
          show-icon
          :closable="false"
          class="novel-create-page__autorun"
        >
          每步写入表单并保存草稿，停在写正文前。
          <el-button link type="primary" @click="cancelSettingAutorun">取消</el-button>
        </el-alert>
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
      <StepFactions
        v-else-if="currentStep === 3"
        :factions="factions"
        :characters="characters"
        :active-id="factionActiveId"
        @update:active-id="factionActiveId = $event"
        @change="markDirty"
        @add="addFaction"
        @remove="removeFaction"
      />
      <StepCharacters
        v-else-if="currentStep === 4"
        :characters="characters"
        :edges="characterEdges"
        :factions="factions"
        :active-id="characterActiveId"
        @update:active-id="characterActiveId = $event"
        @change="markDirty"
        @update:edges="setCharacterEdges"
        @add="addCharacter"
        @remove="removeCharacter"
      />
      <DetailStyle
        v-else-if="stepKey === 'style'"
        ref="styleRef"
        :novel-id="novelId"
      />
      <DetailPlotlines
        v-else-if="stepKey === 'plotline'"
        ref="plotlineRef"
        :novel-id="novelId"
      />
      <StepOutline
        v-else-if="stepKey === 'outline'"
        :form="outlineForm"
        @change="markDirty"
        @add-volume="addOutlineVolume"
      />
      <DetailScripts
        v-else-if="stepKey === 'script'"
        ref="scriptRef"
        :novel-id="novelId"
      />
      <DetailIntentShots
        v-else-if="stepKey === 'intent'"
        ref="intentRef"
        :novel-id="novelId"
      />
      <template v-else-if="stepKey === 'content'">
        <AnomalyFixPanel
          v-if="route.query.anomaly"
          :report-id="route.query.anomaly"
          home="content"
          :auto="fixBoot"
          :reload="retryLoad"
        />
        <StepContentOrg
          :form="contentForm"
          @change="markDirty"
          @add="addChapter"
        />
      </template>

      <template #footer>
        <NovelCreateFooter
          :saving="saving || autorunActive"
          :is-first-step="isFirstStep"
          :is-last-step="isLastStep"
          :finish-label="finishLabel"
          :can-start-writing="canStartWriting"
          :autorun-active="autorunActive"
          @save-draft="saveCurrentDraft"
          @prev="goPrev"
          @next="nextStep"
          @finish="finishWizard"
          @start-writing="goStartWriting"
          @cancel-autorun="cancelSettingAutorun"
        />
      </template>
    </NovelCreateShell>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import NovelCreateShell from '../components/novel/create/NovelCreateShell.vue';
import NovelCreateSteps from '../components/novel/create/NovelCreateSteps.vue';
import NovelCreateFooter from '../components/novel/create/NovelCreateFooter.vue';
import StepBasicInfo from '../components/novel/create/StepBasicInfo.vue';
import StepWorldSetting from '../components/novel/create/StepWorldSetting.vue';
import StepFactions from '../components/novel/create/StepFactions.vue';
import StepCharacters from '../components/novel/create/StepCharacters.vue';
import StepOutline from '../components/novel/create/StepOutline.vue';
import StepContentOrg from '../components/novel/create/StepContentOrg.vue';
import AiFormDock from '../components/novel/ai/AiFormDock.vue';
import AnomalyFixPanel from '../components/novel/AnomalyFixPanel.vue';
import DetailStyle from '../components/novel/detail/DetailStyle.vue';
import DetailPlotlines from '../components/novel/detail/DetailPlotlines.vue';
import DetailScripts from '../components/novel/detail/DetailScripts.vue';
import DetailIntentShots from '../components/novel/detail/DetailIntentShots.vue';
import { useNovelCreateWizard } from '../composables/useNovelCreateWizard.js';
import { BASIC_AI_SCENES, WORLD_AI_SCENES, STYLE_AI_SCENES, PLOTLINE_AI_SCENES, OUTLINE_AI_SCENES, SCRIPT_AI_SCENES, INTENT_AI_SCENES, CONTENT_AI_SCENES, ORCHESTRATE_AI_SCENES, buildCharacterScenes, buildFactionScenes } from '../utils/aiScenes.js';
import { wizardStepOf } from '../utils/novelCreateSchema.js';
import { STUDIO_TAB } from '../utils/novelDetail.js';
import { applyBasicPatch, applyWorldPatch, applyFactionPatch, applyCharacterPatch, applyOutlinePatch, applyChaptersPatch, flattenOutlineTitles } from '../utils/aiApplyPatch.js';
import { dispatchAiPlan } from '../services/aiService.js';
import { routeAfterDispatch } from '../utils/aiDispatchNav.js';
import { useNovelEnums } from '../composables/useNovelEnums.js';
import { basicContextForAgent } from '../utils/aiBoundContext.js';

const {
  WIZARD_STEPS,
  basicForm,
  worldForm,
  factions,
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
  cameFromDetail,
  backLabel,
  finishLabel,
  canStartWriting,
  markDirty,
  markAiSave,
  saveDraft,
  goNext,
  goPrev,
  goToStep,
  finishWizard,
  goStartWriting,
  goBack,
  goBackToList,
  retryLoad,
  addFaction,
  removeFaction,
  addCharacter,
  removeCharacter,
  setCharacterEdges,
  addOutlineVolume,
  addChapter,
  autorunActive,
  autorunLabel,
  runSettingAutorun,
  cancelSettingAutorun,
} = useNovelCreateWizard();

const stepKey = computed(() => stepMeta.value?.key || '');
const styleRef = ref(null);
const plotlineRef = ref(null);
const scriptRef = ref(null);
const intentRef = ref(null);
const route = useRoute();
const router = useRouter();
const fixBoot = ref(false);

watch(loading, (busy, prev) => {
  if (prev && !busy && route.query.fix === '1' && String(route.query.step || '') === String(wizardStepOf('content'))) {
    fixBoot.value = true;
  }
});
const { enums, load: loadEnums } = useNovelEnums();
const showPlanDock = computed(() => route.query.ai === 'plan' && !autorunActive.value);
const expandDock = computed(() => route.query.ai === '1' || route.query.ai === 'plan');
const basicAgentContext = computed(() => basicContextForAgent(basicForm, enums.value));

onMounted(() => {
  loadEnums();
});

const worldFocusPath = ref('');
const factionActiveId = ref('');
const characterActiveId = ref('');
const activeFaction = computed(() => factions.value.find((row) => row.id === factionActiveId.value) || null);
const factionScenes = computed(() => buildFactionScenes(activeFaction.value));
const factionHint = computed(() => {
  if (!activeFaction.value) return '';
  return `正在补全：${activeFaction.value.name || '未命名组织'}`;
});
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
  basic: basicAgentContext.value,
}));

const factionSnapshot = computed(() => ({
  factions: factions.value.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    alignment: row.alignment,
    description: String(row.description || '').slice(0, 240),
    rules: String(row.rules || '').slice(0, 160),
    headquarters: row.headquarters,
  })),
  characters: characters.value.map((row) => ({ id: row.id, name: row.name, role: row.role })),
  world: {
    era: worldForm.era,
    geography: worldForm.geography,
    power_system: worldForm.power_system,
  },
  basic: basicAgentContext.value,
}));

const characterSnapshot = computed(() => ({
  characters: characters.value.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    faction_id: row.faction_id,
    personality: String(row.personality || '').slice(0, 240),
    background: String(row.background || '').slice(0, 240),
    goal: String(row.goal || '').slice(0, 240),
    relations: String(row.relations || '').slice(0, 160),
    appearance: String(row.appearance || '').slice(0, 240),
    speech_style: String(row.speech_style || '').slice(0, 160),
    identity: row.identity || '',
    age: row.age || '',
    arc: String(row.arc || '').slice(0, 240),
  })),
  factions: factions.value.map((row) => ({ id: row.id, name: row.name, kind: row.kind })),
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
  basic: basicAgentContext.value,
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
  basic: basicAgentContext.value,
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
  basic: basicAgentContext.value,
}));

const orchestrateSnapshot = computed(() => ({
  coverage: {
    basic: Boolean(String(basicForm.title || '').trim()),
    world: Boolean(worldForm.era || worldForm.power_system || worldForm.geography),
    factions: factions.value.length > 0,
    characters: characters.value.length > 0,
    outline: (outlineForm.volumes || []).length > 0,
    style: false,
    plotline: false,
    script: false,
    intent: false,
    content: (contentForm.chapters || []).length > 0,
    bodies: false,
  },
  basic: basicAgentContext.value,
}));

function onApplyBasic(patch) {
  applyBasicPatch(basicForm, patch);
  markAiSave('basic');
}

function onApplyWorld(patch) {
  applyWorldPatch(worldForm, patch);
  markAiSave('world');
}

function onApplyFactions(patch, paths = []) {
  applyFactionPatch(factions.value, patch, { paths, characters: characters.value });
  markAiSave('faction');
}

function onApplyCharacters(patch, paths = []) {
  applyCharacterPatch(characters.value, characterEdges.value, patch, { paths });
  markAiSave('character');
}

function onApplyOutline(patch, paths = []) {
  applyOutlinePatch(outlineForm, patch, { paths });
  markAiSave('outline');
}

function onApplyContent(patch, paths = []) {
  applyChaptersPatch(contentForm, patch, { paths });
  markAiSave('chapter_list');
}

async function saveOpenModule() {
  if (stepKey.value === 'plotline' && plotlineRef.value?.hasDraft?.()) await plotlineRef.value.save();
  else if (stepKey.value === 'script' && scriptRef.value?.hasDraft?.()) await scriptRef.value.save();
  else if (stepKey.value === 'intent' && intentRef.value?.hasSuggestion?.()) await intentRef.value.writeSuggestion();
}

async function saveCurrentDraft() {
  await saveOpenModule();
  return saveDraft();
}

async function nextStep() {
  await saveOpenModule();
  return goNext();
}

function onApplyStyle(patch) {
  styleRef.value?.applyFromPatch?.(patch);
}

function onApplyPlotline(patch) {
  plotlineRef.value?.applyFromPatch?.(patch);
}

function onApplyScript(patch) {
  scriptRef.value?.applyFromPatch?.(patch);
}

function onApplyIntent(patch) {
  intentRef.value?.applyFromPatch?.(patch);
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
    const dest = routeAfterDispatch(result);
    if (!dest) {
      ElMessage.error('执行成功但缺少小说 ID');
      return;
    }
    ElMessage.success(result.tab === STUDIO_TAB ? '已执行，正在打开单章开发' : '已执行，正在打开对应步骤');
    if (dest.name === 'novel-detail') {
      router.push(dest);
      return;
    }
    router.replace({ query: { ...route.query, ...dest.query } });
  } catch (err) {
    ElMessage.error(err.message || '执行失败');
  }
}

function onAutorunPlan(meta = {}) {
  runSettingAutorun({ planSessionId: meta.sessionId });
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

.novel-create-page__autorun {
  margin-bottom: 12px;
}
</style>
