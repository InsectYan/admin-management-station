import {
  computed, onMounted, reactive, ref, watch,
} from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  basicFormToPayload,
  buildStepSettingPatch,
  createBasicInfoForm,
  createCharacter,
  createChapterItem,
  createContentForm,
  createFaction,
  createOutlineForm,
  createOutlineVolume,
  createWorldForm,
  WIZARD_STEP_MAX,
  novelToBasicForm,
  settingToForms,
  validateBasicStep,
  WIZARD_STEPS,
} from '../utils/novelCreateSchema.js';
import {
  createNovel,
  fetchNovel,
  updateNovel,
  updateNovelSetting,
} from '../services/novelService.js';
import { applyAiMessage, dispatchAiPlan, listAiSessions } from '../services/aiService.js';
import {
  applyBasicPatch,
  applyWorldPatch,
  applyFactionPatch,
  applyCharacterPatch,
  applyOutlinePatch,
  applyChaptersPatch,
} from '../utils/aiApplyPatch.js';
import { SETTING_FEATURE_LABELS } from '../utils/aiSettingAutorun.js';
import { DETAIL_TAB_MAX } from '../utils/novelDetail.js';
import { firstChapterId } from '../utils/chapterTree.js';

export function useNovelCreateWizard() {
  const route = useRoute();
  const router = useRouter();

  const currentStep = ref(Math.min(WIZARD_STEP_MAX, Math.max(1, Number(route.query.step) || 1)));
  const novelId = ref(route.query.id ? Number(route.query.id) : null);
  const saving = ref(false);
  const loading = ref(false);
  const dirty = ref(false);
  const loadError = ref('');
  const autorunActive = ref(false);
  const autorunLabel = ref('');
  let autorunToken = 0;

  const basicForm = reactive(createBasicInfoForm());
  const worldForm = reactive(createWorldForm());
  const factions = ref([]);
  const characters = ref([]);
  const characterEdges = ref([]);
  const outlineForm = reactive(createOutlineForm());
  const contentForm = reactive(createContentForm());

  const isFirstStep = computed(() => currentStep.value <= 1);
  const isLastStep = computed(() => currentStep.value >= WIZARD_STEPS.length);
  const stepMeta = computed(() => WIZARD_STEPS.find((s) => s.step === currentStep.value));
  const hasDraftId = computed(() => !!novelId.value);

  function syncQuery(extra = {}) {
    const query = {
      ...route.query,
      step: String(currentStep.value),
      ...extra,
    };
    if (novelId.value) {
      query.id = String(novelId.value);
    } else {
      delete query.id;
    }
    router.replace({ query });
  }

  function markDirty() {
    dirty.value = true;
  }

  function applySettingForms(novel) {
    const parsed = settingToForms(novel?.setting_json);
    Object.assign(worldForm, parsed.worldForm);
    factions.value = parsed.factions;
    characters.value = parsed.characters;
    characterEdges.value = parsed.characterEdges;
    outlineForm.volumes = parsed.outlineForm.volumes;
    contentForm.chapters = parsed.contentForm.chapters;
  }

  async function loadNovel(id) {
    loading.value = true;
    loadError.value = '';
    try {
      const novel = await fetchNovel(id);
      Object.assign(basicForm, novelToBasicForm(novel));
      applySettingForms(novel);
      dirty.value = false;
    } catch (e) {
      loadError.value = e.message || '加载草稿失败';
    } finally {
      loading.value = false;
    }
  }

  function retryLoad() {
    if (novelId.value) {
      loadNovel(novelId.value);
    }
  }

  function getFormsSnapshot() {
    return {
      worldForm,
      factions: factions.value,
      characters: characters.value,
      characterEdges: characterEdges.value,
      outlineForm,
      contentForm,
    };
  }

  async function persistBasic(showMessage = true) {
    const error = validateBasicStep(basicForm);
    if (error) {
      ElMessage.warning(error);
      return false;
    }

    saving.value = true;
    try {
      const payload = basicFormToPayload(basicForm);
      if (novelId.value) {
        await updateNovel(novelId.value, payload);
      } else {
        const created = await createNovel(payload);
        novelId.value = created.id;
        syncQuery({ id: String(created.id) });
      }
      dirty.value = false;
      if (showMessage) ElMessage.success('草稿已保存');
      return true;
    } catch (e) {
      ElMessage.error(e.message || '保存失败，请重试');
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function persistCurrentStep(showMessage = true) {
    if (currentStep.value === 1) {
      return persistBasic(showMessage);
    }
    if (!novelId.value) {
      ElMessage.warning('请先完成基础信息并保存');
      return false;
    }

    saving.value = true;
    try {
      const patch = buildStepSettingPatch(currentStep.value, getFormsSnapshot());
      await updateNovelSetting(novelId.value, patch);
      dirty.value = false;
      if (showMessage) ElMessage.success('草稿已保存');
      return true;
    } catch (e) {
      ElMessage.error(e.message || '保存失败，请重试');
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function saveDraft() {
    return persistCurrentStep(true);
  }

  async function persistStepBeforeLeave(step) {
    if (step === 1) return persistBasic(false);
    if (!novelId.value) return true;
    saving.value = true;
    try {
      const patch = buildStepSettingPatch(step, getFormsSnapshot());
      await updateNovelSetting(novelId.value, patch);
      return true;
    } catch (e) {
      ElMessage.error(e.message || '保存失败，请重试');
      return false;
    } finally {
      saving.value = false;
    }
  }

  function cancelSettingAutorun() {
    autorunToken += 1;
    autorunActive.value = false;
    autorunLabel.value = '';
  }

  function currentFormSnapshot() {
    return {
      title: basicForm.title,
      creative_intent: basicForm.creative_intent,
      summary: basicForm.summary,
      story_overview: basicForm.story_overview,
      world: { ...worldForm },
      factions: factions.value,
      characters: characters.value,
      character_edges: characterEdges.value,
      outline: { volumes: outlineForm.volumes },
      chapters: contentForm.chapters,
    };
  }

  function bindNovelId(id) {
    const numeric = Number(id);
    if (!numeric || novelId.value === numeric) return;
    novelId.value = numeric;
    syncQuery({ id: String(numeric) });
  }

  function revealStep(step) {
    const n = Math.min(WIZARD_STEP_MAX, Math.max(1, Number(step) || 1));
    currentStep.value = n;
    dirty.value = false;
    syncQuery({ step: String(n), ai: '1' });
  }

  function applyDispatchPatch(featureKey, patch) {
    if (!patch || typeof patch !== 'object') return;
    if (featureKey === 'basic') applyBasicPatch(basicForm, patch);
    else if (featureKey === 'world') applyWorldPatch(worldForm, patch);
    else if (featureKey === 'factions') applyFactionPatch(factions.value, patch, { characters: characters.value });
    else if (featureKey === 'characters') applyCharacterPatch(characters.value, characterEdges.value, patch);
    else if (featureKey === 'outline') applyOutlinePatch(outlineForm, patch);
    else if (featureKey === 'content') applyChaptersPatch(contentForm, patch);
  }

  async function resolvePlanSessionId(preferred) {
    if (preferred) return preferred;
    const fromQuery = String(route.query.plan_session || '').trim();
    if (fromQuery) return fromQuery;
    if (!novelId.value) return null;
    const listed = await listAiSessions({
      novel_id: novelId.value,
      feature_key: 'orchestrate',
    });
    const rows = Array.isArray(listed) ? listed : [];
    return rows[0]?.id || null;
  }

  async function runSettingAutorun({ planSessionId } = {}) {
    if (autorunActive.value) return;
    const sessionId = await resolvePlanSessionId(planSessionId);
    if (!sessionId) {
      ElMessage.warning('请先生成开书计划');
      syncQuery({ ai: 'plan' });
      return;
    }
    const token = autorunToken + 1;
    autorunToken = token;
    autorunActive.value = true;
    autorunLabel.value = '正在连续执行设定…';
    syncQuery({ ai: '1' });
    try {
      while (autorunToken === token) {
        const result = await dispatchAiPlan({
          plan_session_id: sessionId,
          novel_id: novelId.value,
          scope: 'settings',
          form_snapshot: currentFormSnapshot(),
        });
        if (autorunToken !== token) return;
        if (result?.done || result?.feature_key === 'chapter') {
          ElMessage.success('设定已连续执行到章节目录，正文请到单章开发写');
          revealStep(6);
          break;
        }
        bindNovelId(result.novel_id);
        const feature = result.feature_key;
        const step = Number(result.step) || 1;
        const label = SETTING_FEATURE_LABELS[feature] || feature;
        autorunLabel.value = `正在写入「${label}」并保存草稿`;
        applyDispatchPatch(feature, result.turn?.patch || {});
        if (feature === 'basic' && !basicForm.title?.trim()) {
          basicForm.title = String(result.turn?.patch?.title || '未命名开书');
        }
        revealStep(step);
        const saved = await persistStepBeforeLeave(step);
        if (!saved) {
          ElMessage.error('本步保存失败，已停止连续执行');
          break;
        }
        dirty.value = false;
        if (result.turn?.session_id && result.turn?.message_id) {
          try {
            await applyAiMessage(result.turn.session_id, { message_id: result.turn.message_id });
          } catch {
            /* 标记已应用失败不挡下一步 */
          }
        }
        if (feature === 'content') {
          ElMessage.success('设定已连续执行到章节目录，正文请到单章开发写');
          break;
        }
      }
    } catch (err) {
      if (autorunToken !== token) return;
      if (err?.code === 'PLAN_REQUIRED' || /请先生成开书计划/.test(err.message || '')) {
        ElMessage.warning('请先生成开书计划');
        syncQuery({ ai: 'plan' });
      } else {
        ElMessage.error(err.message || '连续执行失败');
      }
    } finally {
      if (autorunToken === token) {
        autorunActive.value = false;
        autorunLabel.value = '';
      }
    }
  }

  async function consumeAutorunQuery() {
    if (route.query.autorun !== 'settings') return;
    const planSession = route.query.plan_session ? String(route.query.plan_session) : '';
    const query = { ...route.query };
    delete query.autorun;
    await router.replace({ query });
    if (novelId.value) {
      await loadNovel(novelId.value);
      if (loadError.value) return;
    }
    await runSettingAutorun({ planSessionId: planSession || undefined });
  }

  async function goNext() {
    if (autorunActive.value) return;
    const ok = await persistStepBeforeLeave(currentStep.value);
    if (!ok) return;
    dirty.value = false;
    if (currentStep.value < WIZARD_STEPS.length) {
      currentStep.value += 1;
      syncQuery();
    }
  }

  function goPrev() {
    if (autorunActive.value) return;
    if (currentStep.value > 1) {
      currentStep.value -= 1;
      syncQuery();
    }
  }

  async function goToStep(step) {
    if (autorunActive.value) return;
    if (step < 1 || step > WIZARD_STEPS.length || step === currentStep.value) return;
    if (step > 1 && !novelId.value) {
      ElMessage.warning('请先完成基础信息并保存');
      return;
    }
    if (dirty.value) {
      const ok = await persistStepBeforeLeave(currentStep.value);
      if (!ok) return;
      dirty.value = false;
    }
    currentStep.value = step;
    syncQuery();
  }

  const cameFromDetail = computed(() => (
    route.query.from === 'detail' && !!novelId.value
  ));
  const backLabel = computed(() => (cameFromDetail.value ? '返回详情' : '返回列表'));
  const finishLabel = computed(() => (
    cameFromDetail.value ? '完成并返回详情' : '完成并返回列表'
  ));
  const canStartWriting = computed(() => (contentForm.chapters || []).some((ch) => ch && ch.id));

  function goBackToList() {
    router.push({ name: 'novel-list' });
  }

  function goBackToDetail() {
    if (!novelId.value) {
      goBackToList();
      return;
    }
    const tab = Math.min(DETAIL_TAB_MAX, Math.max(1, Number(route.query.detailTab) || 1));
    const query = { tab: String(tab) };
    if (tab === 7 && route.query.detailChapter) {
      query.chapter = String(route.query.detailChapter);
    }
    router.push({
      name: 'novel-detail',
      params: { id: String(novelId.value) },
      query,
    });
  }

  function goBack() {
    if (cameFromDetail.value) goBackToDetail();
    else goBackToList();
  }

  async function finishWizard() {
    const ok = await persistStepBeforeLeave(currentStep.value);
    if (!ok) return;

    saving.value = true;
    try {
      if (novelId.value) {
        await updateNovel(novelId.value, {
          status: 'draft',
          progress_status: 'ongoing',
        });
      }
      dirty.value = false;
      if (cameFromDetail.value) {
        ElMessage.success('设定已保存');
        goBackToDetail();
      } else {
        ElMessage.success('小说创建完成');
        router.push({ name: 'novel-list' });
      }
    } catch (e) {
      ElMessage.error(e.message || '完成失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  async function goStartWriting() {
    if (!canStartWriting.value) {
      ElMessage.info('请先添加或生成章节');
      return;
    }
    const ok = await persistStepBeforeLeave(currentStep.value);
    if (!ok) return;
    if (!novelId.value) {
      ElMessage.warning('请先保存基础信息');
      return;
    }
    const first = firstChapterId(contentForm.chapters);
    if (!first) {
      ElMessage.info('请先添加或生成章节');
      return;
    }
    dirty.value = false;
    router.push({
      name: 'novel-detail',
      params: { id: String(novelId.value) },
      query: { tab: '7', chapter: first },
    });
  }

  function addFaction() {
    factions.value = [...factions.value, createFaction({ name: `组织 ${factions.value.length + 1}` })];
    markDirty();
  }

  function removeFaction(id) {
    factions.value = factions.value.filter((item) => item.id !== id);
    characters.value = characters.value.map((row) => (
      row.faction_id === id ? { ...row, faction_id: '' } : row
    ));
    markDirty();
  }

  function addCharacter() {
    characters.value = [...characters.value, createCharacter()];
    markDirty();
  }

  function removeCharacter(id) {
    characters.value = characters.value.filter((c) => c.id !== id);
    characterEdges.value = characterEdges.value.filter(
      (edge) => edge.source !== id && edge.target !== id,
    );
    markDirty();
  }

  function setCharacterEdges(edges) {
    characterEdges.value = edges;
    markDirty();
  }

  function addOutlineVolume() {
    outlineForm.volumes.push(createOutlineVolume({ title: `第 ${outlineForm.volumes.length + 1} 卷` }));
    markDirty();
  }

  function addChapter() {
    const order = contentForm.chapters.length + 1;
    contentForm.chapters.push(createChapterItem({
      title: `第 ${order} 章`,
      order,
    }));
    markDirty();
  }

  watch(
    () => route.query.id,
    (id) => {
      const numeric = id ? Number(id) : null;
      if (numeric && numeric !== novelId.value) {
        novelId.value = numeric;
        loadNovel(numeric);
      }
    },
  );

  watch(
    () => route.query.step,
    (step) => {
      const n = Math.min(WIZARD_STEP_MAX, Math.max(1, Number(step) || 1));
      if (n !== currentStep.value) currentStep.value = n;
    },
  );

  onMounted(() => {
    if (route.query.autorun === 'settings') {
      consumeAutorunQuery();
      return;
    }
    if (novelId.value) {
      loadNovel(novelId.value);
    }
  });

  onBeforeRouteLeave(async () => {
    if (autorunActive.value) cancelSettingAutorun();
    if (!dirty.value) return true;
    try {
      await ElMessageBox.confirm('有未保存的修改，确定离开吗？', '提示', {
        confirmButtonText: '离开',
        cancelButtonText: '留在此页',
        type: 'warning',
      });
      return true;
    } catch {
      return false;
    }
  });

  return {
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
    dirty,
    loadError,
    autorunActive,
    autorunLabel,
    hasDraftId,
    isFirstStep,
    isLastStep,
    stepMeta,
    cameFromDetail,
    backLabel,
    finishLabel,
    canStartWriting,
    markDirty,
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
    runSettingAutorun,
    cancelSettingAutorun,
  };
}
