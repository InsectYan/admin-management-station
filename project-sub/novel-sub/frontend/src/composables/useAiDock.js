import { computed, onMounted, ref, toValue, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  applyAiMessage,
  createAiSession,
  deleteAiSession,
  listAiMessages,
  listAiSessions,
  streamAiTurn,
  updateAiSession,
} from '../services/aiService.js';
import { collectPaths, findSceneNode, isSelectableScene } from '../utils/aiScenes.js';
import { peelSkillEnvelope, salvagePatchFromContent } from '../utils/aiReplyText.js';

const COLLAPSED_KEY = 'novel-ai-dock-collapsed';

export function useAiDock(options) {
  const scenesOf = () => toValue(options.scenes) || [];
  const featureKeyOf = () => toValue(options.featureKey) || 'basic';
  const novelIdOf = () => toValue(options.novelId) || null;
  const requireNovelIdOf = () => Boolean(toValue(options.requireNovelId));
  const storageKeyOf = () => toValue(options.storageKey) || COLLAPSED_KEY;
  const startExpandedOf = () => Boolean(toValue(options.startExpanded));
  const sessionTitleOf = () => {
    const custom = toValue(options.sessionTitle);
    if (custom) return custom;
    const TITLES = {
      basic: '基础信息',
      world: '世界观',
      characters: '人物',
      outline: '大纲',
      content: '内容组织',
      orchestrate: '开书计划',
    };
    return custom || TITLES[featureKeyOf()] || '基础信息';
  };
  const locked = computed(() => requireNovelIdOf() && !novelIdOf());
  const snapshotOf = () => {
    const raw = toValue(options.formSnapshot);
    return raw && typeof raw === 'object' ? { ...raw } : {};
  };

  const collapsed = ref((() => {
    if (startExpandedOf()) return false;
    const stored = localStorage.getItem(storageKeyOf());
    if (stored === '1') return true;
    if (stored === '0') return false;
    return Boolean(toValue(options.defaultCollapsed));
  })());
  const sessions = ref([]);
  const sessionId = ref(null);
  const messages = ref([]);
  const sending = ref(false);
  const loading = ref(false);
  const error = ref('');
  const input = ref('');
  const selectedId = ref('');
  const pendingAssistantId = ref(null);
  const streamingThinking = ref('');
  const streamingReply = ref('');
  const thinkingLive = ref(false);

  watch(
    () => scenesOf(),
    (scenes) => {
      if (!scenes?.length) return;
      if (!findSceneNode(scenes, selectedId.value)) {
        selectedId.value = scenes[0].id;
      }
    },
    { immediate: true },
  );

  const selectedNode = computed(() => findSceneNode(scenesOf(), selectedId.value));
  const targetFields = computed(() => collectPaths(selectedNode.value));
  const scene = computed(() => selectedNode.value?.scene || featureKeyOf());
  const placeholder = computed(() => selectedNode.value?.placeholder || '想让林间写手帮点什么？');
  const pendingMessage = computed(() => (
    messages.value.find((row) => row.id === pendingAssistantId.value) || null
  ));
  function effectivePatch(row) {
    const stored = row?.patch_json;
    if (stored && typeof stored === 'object' && Object.keys(stored).length) return stored;
    return salvagePatchFromContent(row?.content);
  }

  const canApply = computed(() => Object.keys(effectivePatch(pendingMessage.value)).length > 0);

  function toggleCollapsed() {
    collapsed.value = !collapsed.value;
    localStorage.setItem(storageKeyOf(), collapsed.value ? '1' : '0');
  }

  function selectScene(id, { expand = false } = {}) {
    const node = findSceneNode(scenesOf(), id);
    if (node && !isSelectableScene(node)) return;
    selectedId.value = id;
    if (expand && collapsed.value) {
      collapsed.value = false;
      localStorage.setItem(storageKeyOf(), '0');
    }
  }

  async function refreshSessions() {
    const params = { feature_key: featureKeyOf() };
    if (novelIdOf()) params.novel_id = novelIdOf();
    sessions.value = (await listAiSessions(params)) || [];
  }

  async function loadMessages() {
    if (!sessionId.value) {
      messages.value = [];
      return;
    }
    messages.value = (await listAiMessages(sessionId.value)) || [];
    const lastAssistant = [...messages.value].reverse().find((row) => row.role === 'assistant' && !row.applied);
    pendingAssistantId.value = lastAssistant?.id || null;
  }

  async function ensureSession() {
    await refreshSessions();
    if (sessions.value.length) {
      sessionId.value = sessions.value[0].id;
    } else {
      const created = await createAiSession({
        feature_key: featureKeyOf(),
        novel_id: novelIdOf(),
        title: sessionTitleOf(),
      });
      sessionId.value = created.id;
      sessions.value = [created];
    }
    await loadMessages();
  }

  async function createSession(title) {
    if (locked.value) {
      ElMessage.info('请先保存基础信息');
      return;
    }
    const name = String(title || '').trim() || `会话 ${sessions.value.length + 1}`;
    const created = await createAiSession({
      feature_key: featureKeyOf(),
      novel_id: novelIdOf(),
      title: name,
    });
    sessions.value = [created, ...sessions.value];
    sessionId.value = created.id;
    messages.value = [];
    pendingAssistantId.value = null;
  }

  async function switchSession(id) {
    sessionId.value = id;
    await loadMessages();
  }

  async function removeSession() {
    if (locked.value || sending.value || !sessionId.value) return;
    const current = sessions.value.find((row) => row.id === sessionId.value);
    const label = current?.title || `会话 ${sessionId.value}`;
    try {
      await ElMessageBox.confirm(`删除「${label}」及其对话记录？此操作不可恢复。`, '删除会话', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }
    const removedId = sessionId.value;
    try {
      await deleteAiSession(removedId);
    } catch (err) {
      ElMessage.error(err.message || '删除失败');
      return;
    }
    sessions.value = sessions.value.filter((row) => row.id !== removedId);
    if (sessions.value.length) {
      sessionId.value = sessions.value[0].id;
      await loadMessages();
    } else {
      sessionId.value = null;
      messages.value = [];
      pendingAssistantId.value = null;
      await createSession();
    }
    ElMessage.success('会话已删除');
  }

  async function send() {
    const text = input.value.trim();
    if (!text || sending.value) return;
    if (locked.value) {
      ElMessage.info('请先保存基础信息');
      return;
    }
    if (selectedNode.value && !isSelectableScene(selectedNode.value) && !selectedNode.value.children?.length) {
      ElMessage.info(selectedNode.value.disabledHint || '该字段请在表单中手动选择');
      return;
    }
    if (!sessionId.value) await ensureSession();
    sending.value = true;
    error.value = '';
    input.value = '';
    thinkingLive.value = true;
    streamingThinking.value = '';
    streamingReply.value = '';
    const tempId = `tmp-user-${Date.now()}`;
    messages.value = [...messages.value, { id: tempId, role: 'user', content: text }];
    try {
      await streamAiTurn(sessionId.value, {
        message: text,
        scene: scene.value,
        target_fields: targetFields.value,
        form_snapshot: snapshotOf(),
      }, {
        onThinking: (payload) => {
          if (payload?.text) {
            const peeled = peelSkillEnvelope(payload.text);
            streamingThinking.value = peeled.thinking;
            streamingReply.value = peeled.reply;
            if (!peeled.thinking && !peeled.reply) {
              streamingThinking.value = payload.text;
            }
            return;
          }
          if (payload?.label) streamingThinking.value = payload.label;
        },
        onDone: (data) => {
          thinkingLive.value = false;
          streamingThinking.value = '';
          streamingReply.value = '';
          messages.value = messages.value.filter((row) => row.id !== tempId);
          if (Array.isArray(data?.messages) && data.messages.length) {
            messages.value = [...messages.value, ...data.messages];
          }
          const assistant = [...(data?.messages || [])].reverse().find((row) => row.role === 'assistant');
          pendingAssistantId.value = assistant?.id || pendingAssistantId.value;
        },
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      error.value = err.message || '生成失败';
      ElMessage.error(error.value);
    } finally {
      thinkingLive.value = false;
      streamingThinking.value = '';
      streamingReply.value = '';
      sending.value = false;
    }
  }

  async function applyPending() {
    const row = pendingMessage.value;
    if (!row || !sessionId.value) return null;
    const patch = effectivePatch(row);
    if (!Object.keys(patch).length) return {};
    await applyAiMessage(sessionId.value, {
      message_id: row.id,
      paths: targetFields.value,
    });
    row.applied = true;
    row.patch_json = { ...patch };
    pendingAssistantId.value = null;
    return patch;
  }

  function discardPending() {
    pendingAssistantId.value = null;
  }

  watch(
    () => startExpandedOf(),
    (expand) => {
      if (expand) collapsed.value = false;
    },
  );

  watch(
    () => novelIdOf(),
    async (id, prev) => {
      if (!id || id === prev) return;
      if (!sessionId.value) {
        if (!requireNovelIdOf()) return;
        loading.value = true;
        try {
          await ensureSession();
        } catch (err) {
          error.value = err.message || '会话加载失败';
        } finally {
          loading.value = false;
        }
        return;
      }
      try {
        await updateAiSession(sessionId.value, { novel_id: id });
        await refreshSessions();
      } catch {
        /* bind 失败不挡保存 */
      }
    },
  );

  onMounted(() => {
    if (requireNovelIdOf() && !novelIdOf()) {
      loading.value = false;
      return;
    }
    loading.value = true;
    ensureSession()
      .catch((err) => {
        error.value = err.message || '会话加载失败';
      })
      .finally(() => {
        loading.value = false;
      });
  });

  return {
    collapsed,
    toggleCollapsed,
    sessions,
    sessionId,
    messages,
    sending,
    loading,
    error,
    locked,
    input,
    selectedId,
    selectedNode,
    scene,
    targetFields,
    placeholder,
    canApply,
    pendingMessage,
    streamingThinking,
    streamingReply,
    thinkingLive,
    selectScene,
    createSession,
    removeSession,
    switchSession,
    send,
    applyPending,
    discardPending,
  };
}
