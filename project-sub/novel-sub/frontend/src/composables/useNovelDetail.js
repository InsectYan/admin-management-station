import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchNovel } from '../services/novelService.js';
import {
  createBasicInfoForm,
  createContentForm,
  createOutlineForm,
  createWorldForm,
} from '../utils/novelCreateSchema.js';
import {
  DETAIL_TABS,
  DETAIL_TAB_MAX,
  parseNovelDetail,
  buildProgressMeta,
  tabFilled,
} from '../utils/novelDetail.js';
import { formatDateTime } from '../utils/formatDateTime.js';

export function useNovelDetail() {
  const route = useRoute();
  const router = useRouter();

  const loading = ref(false);
  const loadError = ref('');
  const novelId = computed(() => Number(route.params.id) || null);
  const currentTab = ref(Math.min(DETAIL_TAB_MAX, Math.max(1, Number(route.query.tab) || 1)));
  const currentChapterId = ref(String(route.query.chapter || ''));

  const basic = reactive(createBasicInfoForm());
  const worldForm = reactive(createWorldForm());
  const factions = ref([]);
  const characters = ref([]);
  const characterEdges = ref([]);
  const outlineForm = reactive(createOutlineForm());
  const contentForm = reactive(createContentForm());
  const novelMeta = reactive({
    id: null,
    created_at: '',
    updated_at: '',
    status: '',
  });

  const tabMeta = computed(() => DETAIL_TABS.find((t) => t.step === currentTab.value));
  const progressMeta = computed(() => buildProgressMeta({
    basic,
    outlineForm,
    contentForm,
  }));

  const filledMap = computed(() => {
    const snapshot = {
      basic, worldForm, factions: factions.value, characters: characters.value, outlineForm, contentForm,
    };
    return Object.fromEntries(DETAIL_TABS.map((t) => [t.key, tabFilled(t.key, snapshot)]));
  });

  function applyNovel(novel) {
    const parsed = parseNovelDetail(novel);
    Object.assign(basic, parsed.basic);
    basic.progress_percent = Number(novel.progress_percent) || 0;
    basic.word_count = Number(novel.word_count) || 0;
    basic.word_target = Number(novel.word_target) || 0;
    basic.chapter_written = Number(novel.chapter_written) || 0;
    basic.chapter_total = Number(novel.chapter_total) || 0;
    Object.assign(worldForm, parsed.worldForm);
    factions.value = parsed.factions || [];
    characters.value = parsed.characters;
    characterEdges.value = parsed.characterEdges;
    outlineForm.volumes = parsed.outlineForm.volumes;
    contentForm.chapters = parsed.contentForm.chapters;
    novelMeta.id = novel.id;
    novelMeta.created_at = formatDateTime(novel.created_at);
    novelMeta.updated_at = formatDateTime(novel.updated_at);
    novelMeta.status = novel.status || '';
  }

  async function loadNovel(id = novelId.value) {
    if (!id) {
      loadError.value = '缺少小说 ID';
      return;
    }
    loading.value = true;
    loadError.value = '';
    try {
      const novel = await fetchNovel(id);
      applyNovel(novel);
    } catch (e) {
      loadError.value = e.message || '加载详情失败';
    } finally {
      loading.value = false;
    }
  }

  function retryLoad() {
    loadNovel();
  }

  function syncQuery(extra = {}) {
    const query = {
      ...route.query,
      tab: String(currentTab.value),
      ...extra,
    };
    if (currentTab.value === 7 && currentChapterId.value) {
      query.chapter = currentChapterId.value;
    } else {
      delete query.chapter;
    }
    if (currentTab.value !== 7) delete query.queue;
    router.replace({ query });
  }

  function goToTab(step) {
    if (step < 1 || step > DETAIL_TABS.length || step === currentTab.value) return;
    currentTab.value = step;
    syncQuery();
  }

  function goPrevTab() {
    if (currentTab.value > 1) goToTab(currentTab.value - 1);
  }

  function goNextTab() {
    if (currentTab.value < DETAIL_TABS.length) goToTab(currentTab.value + 1);
  }

  function goBackToList() {
    router.push({ name: 'novel-list' });
  }

  function goToWizard(step = currentTab.value, extra = {}) {
    if (!novelId.value) return;
    const wizardStep = step >= 7 ? 6 : step;
    router.push({
      name: 'novel-create',
      query: {
        id: String(novelId.value),
        step: String(wizardStep),
        from: 'detail',
        detailTab: String(currentTab.value),
        ...(currentTab.value === 7 && currentChapterId.value
          ? { detailChapter: currentChapterId.value }
          : {}),
        ...extra,
      },
    });
  }

  function goToStudioChapter(id) {
    currentChapterId.value = id || '';
    currentTab.value = 7;
    syncQuery();
  }

  function goToReader() {
    currentTab.value = 8;
    syncQuery();
  }

  function goToQa() {
    if (!novelId.value) return;
    router.push({ name: 'novel-qa', params: { id: String(novelId.value) } });
  }

  const startQueue = computed(() => (
    currentTab.value === 7 && String(route.query.queue || '') === '1'
  ));

  function clearQueueQuery() {
    if (!route.query.queue) return;
    const query = { ...route.query };
    delete query.queue;
    router.replace({ query });
  }

  function goToAiComplete() {
    goToWizard(currentTab.value, { ai: '1' });
  }

  function goToPlan() {
    goToWizard(currentTab.value, { ai: 'plan' });
  }

  function goToPlanAutorun() {
    goToWizard(currentTab.value, { ai: 'plan', autorun: 'settings' });
  }

  function onChapterChange(id) {
    currentChapterId.value = id || '';
    if (currentTab.value === 7) syncQuery();
  }

  watch(
    () => route.params.id,
    (id) => {
      const numeric = id ? Number(id) : null;
      if (numeric) loadNovel(numeric);
    },
  );

  watch(
    () => route.query.tab,
    (tab) => {
      const n = Math.min(DETAIL_TAB_MAX, Math.max(1, Number(tab) || 1));
      if (n !== currentTab.value) currentTab.value = n;
    },
  );

  watch(
    () => route.query.chapter,
    (chapter) => {
      const next = String(chapter || '');
      if (next !== currentChapterId.value) currentChapterId.value = next;
    },
  );

  onMounted(() => {
    loadNovel();
  });

  return {
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
  };
}
