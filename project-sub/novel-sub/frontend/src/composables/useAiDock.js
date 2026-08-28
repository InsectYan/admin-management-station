import { computed, onMounted, ref, toValue, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  applyAiMessage,
  createAiSession,
  listAiMessages,
  listAiSessions,
  streamAiTurn,
  updateAiSession,
} from '../services/aiService.js';
import { collectPaths, findSceneNode, isSelectableScene } from '../utils/aiScenes.js';

const COLLAPSED_KEY = 'novel-ai-dock-collapsed';

export function useAiDock(options) {
  const scenesOf = () => toValue(options.scenes) || [];
  const featureKeyOf = () => toValue(options.featureKey) || 'basic';
  const novelIdOf = () => toValue(options.novelId) || null;
  const snapshotOf = () => {
    const raw = toValue(options.formSnapshot);
    return raw && typeof raw === 'object' ? { ...raw } : {};
  };

  const collapsed = ref(localStorage.getItem(COLLAPSED_KEY) === '1');
  const sessions = ref([]);
  const sessionId = ref(null);
  const messages = ref([]);
  const sending = ref(false);
  const loading = ref(false);
  const error = ref('');
  const input = ref('');
  const selectedId = ref('title');
  const pendingAssistantId = ref(null);
  const streamingThinking = ref('');
  const thinkingLive = ref(false);

  const selectedNode = computed(() => findSceneNode(scenesOf(), selectedId.value));
  const targetFields = computed(() => collectPaths(selectedNode.value));
  const scene = computed(() => selectedNode.value?.scene || 'basic');
  const placeholder = computed(() => selectedNode.value?.placeholder || '想让林间写手帮点什么？');
  const pendingMessage = computed(() => (
    messages.value.find((row) => row.id === pendingAssistantId.value) || null
  ));
  const canApply = computed(() => {
    const patch = pendingMessage.value?.patch_json;
    return Boolean(patch && typeof patch === 'object' && Object.keys(patch).length);
  });

  function toggleCollapsed() {
    collapsed.value = !collapsed.value;
    localStorage.setItem(COLLAPSED_KEY, collapsed.value ? '1' : '0');
  }

  function selectScene(id, { expand = false } = {}) {
    const node = findSceneNode(scenesOf(), id);
    if (node && !isSelectableScene(node)) return;
    selectedId.value = id;
    if (expand && collapsed.value) {
      collapsed.value = false;
      localStorage.setItem(COLLAPSED_KEY, '0');
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
        title: '基础信息',
      });
      sessionId.value = created.id;
      sessions.value = [created];
    }
    await loadMessages();
  }

  async function createSession() {
    const created = await createAiSession({
      feature_key: featureKeyOf(),
      novel_id: novelIdOf(),
      title: `会话 ${sessions.value.length + 1}`,
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

  async function send() {
    const text = input.value.trim();
    if (!text || sending.value) return;
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
            streamingThinking.value = payload.text;
            return;
          }
          const piece = payload?.delta || payload?.label || '';
          if (piece) streamingThinking.value = `${streamingThinking.value}${streamingThinking.value ? '\n' : ''}${piece}`;
        },
        onDone: (data) => {
          thinkingLive.value = false;
          streamingThinking.value = '';
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
      sending.value = false;
    }
  }

  async function applyPending() {
    const row = pendingMessage.value;
    if (!row || !sessionId.value) return null;
    await applyAiMessage(sessionId.value, {
      message_id: row.id,
      paths: targetFields.value,
    });
    row.applied = true;
    pendingAssistantId.value = null;
    return row.patch_json || {};
  }

  function discardPending() {
    pendingAssistantId.value = null;
  }

  watch(
    () => novelIdOf(),
    async (id, prev) => {
      if (!id || id === prev || !sessionId.value) return;
      try {
        await updateAiSession(sessionId.value, { novel_id: id });
        await refreshSessions();
      } catch {
        /* bind 失败不挡保存 */
      }
    },
  );

  onMounted(() => {
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
    input,
    selectedId,
    selectedNode,
    scene,
    targetFields,
    placeholder,
    canApply,
    pendingMessage,
    streamingThinking,
    thinkingLive,
    selectScene,
    createSession,
    switchSession,
    send,
    applyPending,
    discardPending,
  };
}
