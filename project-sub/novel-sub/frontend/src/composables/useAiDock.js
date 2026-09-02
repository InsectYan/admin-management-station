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
import { localizeThinking } from '../utils/aiChatDisplay.js';

const COLLAPSED_KEY = 'novel-ai-dock-collapsed';

export function useAiDock(options) {
  const scenesOf = () => toValue(options.scenes) || [];
  const featureKeyOf = () => toValue(options.featureKey) || 'basic';
  const novelIdOf = () => toValue(options.novelId) || null;
  const requireNovelIdOf = () => Boolean(toValue(options.requireNovelId));
  const alwaysInteractiveOf = () => Boolean(toValue(options.alwaysInteractive));
  const sessionLockedOf = () => Boolean(toValue(options.sessionLocked));
  const storageKeyOf = () => toValue(options.storageKey) || COLLAPSED_KEY;
  const startExpandedOf = () => Boolean(toValue(options.startExpanded));
  const sessionTitleOf = () => {
    const custom = toValue(options.sessionTitle);
    if (custom) return custom;
    const TITLES = {
      basic: '基础信息',
      world: '世界观',
      factions: '门派组织',
      characters: '人物',
      outline: '大纲',
      content: '章节目录',
      chapter: '单章正文',
      orchestrate: '开书计划',
    };
    return custom || TITLES[featureKeyOf()] || '基础信息';
  };
  const hasNovelId = () => {
    const id = toValue(options.novelId);
    return id != null && id !== '';
  };
  const locked = computed(() => {
    if (sessionLockedOf()) return true;
    if (alwaysInteractiveOf()) return false;
    return requireNovelIdOf() && !hasNovelId();
  });
  function lockReason() {
    const custom = toValue(options.lockHint);
    if (custom) return custom;
    if (sessionLockedOf()) return '打开「编辑」后才能对话';
    return '请先保存基础信息';
  }
  const writeLocked = computed(() => Boolean(toValue(options.writeLocked)));
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
      if (!selectedId.value) return;
      if (!findSceneNode(scenes, selectedId.value)) {
        selectedId.value = '';
      }
    },
    { immediate: true },
  );

  const selectedNode = computed(() => findSceneNode(scenesOf(), selectedId.value));
  const rootScene = computed(() => scenesOf()[0] || null);
  const activeNode = computed(() => selectedNode.value || rootScene.value);
  const targetFields = computed(() => collectPaths(activeNode.value));
  const scene = computed(() => activeNode.value?.scene || featureKeyOf());
  const placeholder = computed(() => (
    selectedNode.value?.placeholder
    || rootScene.value?.placeholder
    || '想让林间写手帮点什么？不选模块则按本步全部可填字段生成。'
  ));
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
    const opening = expand && collapsed.value;
    if (opening) {
      selectedId.value = id;
      collapsed.value = false;
      localStorage.setItem(storageKeyOf(), '0');
      return;
    }
    selectedId.value = selectedId.value === id ? '' : id;
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
      ElMessage.info(lockReason());
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

  async function sendText(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || sending.value) return false;
    if (locked.value) {
      ElMessage.info(lockReason());
      return false;
    }
    if (selectedNode.value && !isSelectableScene(selectedNode.value) && !selectedNode.value.children?.length) {
      ElMessage.info(selectedNode.value.disabledHint || '该字段请在表单中手动选择');
      return false;
    }
    if (collapsed.value) collapsed.value = false;
    if (!sessionId.value) await ensureSession();
    sending.value = true;
    error.value = '';
    input.value = '';
    thinkingLive.value = true;
    streamingThinking.value = '';
    streamingReply.value = '';
    const tempId = `tmp-user-${Date.now()}`;
    messages.value = [...messages.value, { id: tempId, role: 'user', content: trimmed }];
    try {
      await streamAiTurn(sessionId.value, {
        message: trimmed,
        scene: scene.value,
        target_fields: targetFields.value,
        form_snapshot: snapshotOf(),
      }, {
        onThinking: (payload) => {
          if (payload?.text) {
            const peeled = peelSkillEnvelope(payload.text);
            streamingThinking.value = localizeThinking(peeled.thinking);
            streamingReply.value = peeled.reply;
            if (!peeled.thinking && !peeled.reply) {
              streamingThinking.value = localizeThinking(payload.text);
            }
            return;
          }
          if (payload?.label) streamingThinking.value = localizeThinking(payload.label);
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
      if (err?.name === 'AbortError') return false;
      error.value = err.message || '生成失败';
      ElMessage.error(error.value);
      return false;
    } finally {
      thinkingLive.value = false;
      streamingThinking.value = '';
      streamingReply.value = '';
      sending.value = false;
    }
    return true;
  }

  async function send() {
    return sendText(input.value);
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
    writeLocked,
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
    sendText,
    applyPending,
    discardPending,
  };
}
