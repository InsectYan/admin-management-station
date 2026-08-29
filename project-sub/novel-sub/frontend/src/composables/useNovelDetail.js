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
  parseNovelDetail,
  buildProgressMeta,
  tabFilled,
} from '../utils/novelDetail.js';

export function useNovelDetail() {
  const route = useRoute();
  const router = useRouter();

  const loading = ref(false);
  const loadError = ref('');
  const novelId = computed(() => Number(route.params.id) || null);
  const currentTab = ref(Math.min(5, Math.max(1, Number(route.query.tab) || 1)));

  const basic = reactive(createBasicInfoForm());
  const worldForm = reactive(createWorldForm());
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
    const snapshot = { basic, worldForm, characters: characters.value, outlineForm, contentForm };
    return Object.fromEntries(DETAIL_TABS.map((t) => [t.key, tabFilled(t.key, snapshot)]));
  });

  function applyNovel(novel) {
    const parsed = parseNovelDetail(novel);
    Object.assign(basic, parsed.basic);
    Object.assign(worldForm, parsed.worldForm);
    characters.value = parsed.characters;
    characterEdges.value = parsed.characterEdges;
    outlineForm.volumes = parsed.outlineForm.volumes;
    contentForm.chapters = parsed.contentForm.chapters;
    novelMeta.id = novel.id;
    novelMeta.created_at = novel.created_at || '';
    novelMeta.updated_at = novel.updated_at || '';
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
    router.replace({
      query: {
        ...route.query,
        tab: String(currentTab.value),
        ...extra,
      },
    });
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
    router.push({
      name: 'novel-create',
      query: { id: String(novelId.value), step: String(step), ...extra },
    });
  }

  function goToAiComplete() {
    goToWizard(currentTab.value, { ai: '1' });
  }

  function goToPlan() {
    goToWizard(currentTab.value, { ai: 'plan' });
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
      const n = Math.min(5, Math.max(1, Number(tab) || 1));
      if (n !== currentTab.value) currentTab.value = n;
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
    goToAiComplete,
    goToPlan,
  };
}
