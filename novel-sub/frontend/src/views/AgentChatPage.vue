<template>
  <PageShell title="AI 创作助手">
    <div class="agent-chat-wrap">
      <div class="agent-meta">
        <span class="agent-meta-label">会话 ID：</span>
        <el-text tag="code">{{ sessionId }}</el-text>
        <el-select
          v-model="llmProfile"
          placeholder="选择模型"
          style="min-width: 220px"
        >
          <el-option
            v-for="p in profiles"
            :key="p.id"
            :label="`${p.label}${p.available ? '' : '（不可用）'}`"
            :value="p.id"
            :disabled="!p.available"
          />
        </el-select>
      </div>

      <div class="novel-agent-chat-panel">
        <p v-for="(m, i) in messages" :key="i">
          <strong>{{ m.role === 'user' ? '你' : '助手' }}：</strong> {{ m.content }}
        </p>
        <p v-if="streaming" class="streaming-text">
          <strong>助手（流式）：</strong> {{ streaming }}
        </p>
        <p v-if="!messages.length && !streaming" class="empty-hint">
          输入创作需求，通过 agent-server SSE 与 Pi 对话。
        </p>
      </div>

      <p v-if="status" class="status-text">{{ status }}</p>

      <el-input
        v-model="input"
        type="textarea"
        :rows="3"
        placeholder="例如：帮我写一段都市言情开篇…"
        @keydown.enter.exact.prevent="handleSend"
      />
      <el-button type="primary" :loading="loading" style="margin-top: 12px" @click="handleSend">
        发送
      </el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchLlmProfiles, streamAgentChat } from '../services/agentChat.js';

function newSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const sessionId = newSessionId();
const profiles = ref([]);
const llmProfile = ref('');
const input = ref('');
const status = ref('');
const streaming = ref('');
const messages = ref([]);
const loading = ref(false);

onMounted(() => {
  fetchLlmProfiles()
    .then(data => {
      profiles.value = data.profiles || [];
      llmProfile.value = data.default_profile_id || '';
    })
    .catch(() => ElMessage.warning('无法加载 LLM 配置，请确认 agent-server 已启动'));
});

async function handleSend() {
  const text = input.value.trim();
  if (!text || loading.value) return;

  input.value = '';
  loading.value = true;
  streaming.value = '';
  status.value = '连接中…';
  messages.value.push({ role: 'user', content: text });

  try {
    await streamAgentChat(
      {
        session_id: sessionId,
        message: text,
        llm_profile: llmProfile.value || undefined,
      },
      {
        onStatus: ({ label }) => { status.value = label || ''; },
        onDelta: ({ reply }) => { streaming.value = reply || ''; },
        onMessage: payload => {
          const reply = payload.reply || payload.response || '';
          messages.value.push({ role: 'assistant', content: reply });
          streaming.value = '';
          status.value = '';
        },
        onError: ({ message: msg }) => ElMessage.error(msg || 'Agent 错误'),
      },
    );
  } catch (e) {
    ElMessage.error(e.message || '对话失败');
  } finally {
    loading.value = false;
    status.value = '';
    streaming.value = '';
  }
}
</script>

<style scoped>
.agent-chat-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.agent-meta-label {
  color: #909399;
  font-size: 14px;
}

.streaming-text {
  color: #909399;
}

.empty-hint {
  color: #909399;
}

.status-text {
  color: #909399;
  font-size: 14px;
  margin: 0;
}
</style>
