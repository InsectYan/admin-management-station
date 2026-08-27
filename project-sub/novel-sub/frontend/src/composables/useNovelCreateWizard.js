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
  createOutlineForm,
  createOutlineVolume,
  createWorldForm,
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

export function useNovelCreateWizard() {
  const route = useRoute();
  const router = useRouter();

  const currentStep = ref(Math.min(5, Math.max(1, Number(route.query.step) || 1)));
  const novelId = ref(route.query.id ? Number(route.query.id) : null);
  const saving = ref(false);
  const loading = ref(false);
  const dirty = ref(false);
  const loadError = ref('');

  const basicForm = reactive(createBasicInfoForm());
  const worldForm = reactive(createWorldForm());
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

  async function goNext() {
    const ok = await persistStepBeforeLeave(currentStep.value);
    if (!ok) return;
    dirty.value = false;
    if (currentStep.value < WIZARD_STEPS.length) {
      currentStep.value += 1;
      syncQuery();
    }
  }

  function goPrev() {
    if (currentStep.value > 1) {
      currentStep.value -= 1;
      syncQuery();
    }
  }

  async function goToStep(step) {
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
      ElMessage.success('小说创建完成');
      router.push({ name: 'novel-list' });
    } catch (e) {
      ElMessage.error(e.message || '完成失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  function goBackToList() {
    router.push({ name: 'novel-list' });
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
      const n = Math.min(5, Math.max(1, Number(step) || 1));
      if (n !== currentStep.value) currentStep.value = n;
    },
  );

  onMounted(() => {
    if (novelId.value) {
      loadNovel(novelId.value);
    }
  });

  onBeforeRouteLeave(async () => {
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
    hasDraftId,
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
  };
}
