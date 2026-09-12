<template>
  <div :class="['llm-profile-panel', { collapsed }]">
    <div :class="['llm-profile-bar', { collapsed }]">
      <el-tooltip
        v-if="collapsed"
        :content="selectedLabel || '选择 AI 模型'"
        placement="right"
      >
        <el-icon class="llm-profile-icon"><Cpu /></el-icon>
      </el-tooltip>
      <span v-show="!collapsed" class="llm-profile-label">AI 模型</span>
      <el-select
        v-model="profileId"
        :placeholder="loading ? '加载中…' : '选择模型'"
        :loading="loading"
        :disabled="loading || !profiles.length"
        :class="['llm-profile-select', { collapsed }]"
        size="small"
        popper-class="app-sider-popper"
        @change="onProfileChange"
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
    <div :class="['llm-profile-bar', 'llm-token-bar', { collapsed }]">
      <el-tooltip
        v-if="collapsed"
        :content="tokenHint"
        placement="right"
      >
        <el-icon class="llm-profile-icon"><Opportunity /></el-icon>
      </el-tooltip>
      <span v-show="!collapsed" class="llm-profile-label">最大 Token</span>
      <el-select
        v-model="maxTokens"
        :placeholder="defaultTokenLabel"
        clearable
        :class="['llm-profile-select', { collapsed }]"
        size="small"
        popper-class="app-sider-popper"
        @change="onMaxTokensChange"
      >
        <el-option
          :label="defaultTokenLabel"
          value=""
        />
        <el-option
          v-for="k in tokenOptionsK"
          :key="k"
          :label="`${k}k`"
          :value="tokensFromK(k)"
        />
      </el-select>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Cpu, Opportunity } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { fetchLlmProfiles } from '../services/llmService.js';
import {
  persistProfileForMenu,
  readLlmProfileId,
  syncProfileForMenuChange,
} from '../composables/useLlmProfile.js';
import {
  LLM_MAX_TOKEN_OPTIONS_K,
  formatTokenLabel,
  readLlmMaxTokens,
  tokensFromK,
  writeLlmMaxTokens,
} from '../composables/useLlmMaxTokens.js';

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  menuKey: { type: String, default: '' },
});

const profiles = ref([]);
const profileId = ref('');
const defaultProfileId = ref('');
const loading = ref(true);
const maxTokens = ref('');
const tokenOptionsK = LLM_MAX_TOKEN_OPTIONS_K;

const selectedLabel = computed(() => {
  const hit = profiles.value.find(p => p.id === profileId.value);
  return hit?.label || profileId.value;
});

const selectedDefaultTokens = computed(() => {
  const hit = profiles.value.find(p => p.id === profileId.value);
  return Number(hit?.default_max_tokens) || 0;
});

const defaultTokenLabel = computed(() => {
  const label = formatTokenLabel(selectedDefaultTokens.value);
  return label ? `默认（${label}）` : '默认（按模型）';
});

const tokenHint = computed(() => {
  if (maxTokens.value) return `最大 Token ${formatTokenLabel(maxTokens.value)}`;
  return defaultTokenLabel.value;
});

function applyInitialProfile() {
  const stored = readLlmProfileId();
  if (stored && profiles.value.some(p => p.id === stored && p.available)) {
    profileId.value = stored;
    return;
  }
  const fallback = profiles.value.find(p => p.id === defaultProfileId.value && p.available)
    || profiles.value.find(p => p.available);
  if (fallback) {
    profileId.value = fallback.id;
    persistProfileForMenu(props.menuKey, fallback.id);
  }
}

function onProfileChange(id) {
  persistProfileForMenu(props.menuKey, id);
}

function onMaxTokensChange(value) {
  writeLlmMaxTokens(value);
}

onMounted(async () => {
  maxTokens.value = readLlmMaxTokens();
  try {
    const data = await fetchLlmProfiles();
    profiles.value = data.profiles || [];
    defaultProfileId.value = data.default_profile_id || '';
    applyInitialProfile();
  } catch {
    ElMessage.warning('无法加载 LLM 配置，请确认 Agent 平台已启动');
  } finally {
    loading.value = false;
  }
});

watch(
  () => props.menuKey,
  (nextKey, prevKey) => {
    if (!nextKey || nextKey === prevKey) return;
    const next = syncProfileForMenuChange(prevKey, nextKey, profileId.value);
    if (next && profiles.value.some(p => p.id === next)) {
      profileId.value = next;
    }
  },
);
</script>

<style scoped>
.llm-profile-panel {
  border-bottom: 1px solid rgba(47, 138, 91, 0.14);
}

.llm-profile-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.llm-token-bar {
  padding-top: 0;
}

.llm-profile-bar.collapsed {
  flex-direction: column;
  padding: 8px 4px;
  gap: 4px;
}

.llm-profile-label {
  flex-shrink: 0;
  width: 68px;
  color: #5c6b62;
  font-size: 12px;
  white-space: nowrap;
}

.llm-profile-icon {
  color: #2f8a5b;
  font-size: 18px;
}

.llm-profile-select {
  flex: 1;
  min-width: 0;
}

.llm-profile-select.collapsed {
  width: 52px;
}

.llm-profile-select :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.78);
  box-shadow: none;
  min-height: 26px;
}

.llm-profile-select :deep(.el-select__placeholder),
.llm-profile-select :deep(.el-select__selected-item) {
  color: #2c4336;
  font-size: 12px;
}
</style>
