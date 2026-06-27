<template>
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
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Cpu } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { fetchLlmProfiles } from '../services/llmService.js';
import {
  persistProfileForMenu,
  readLlmProfileId,
  syncProfileForMenuChange,
} from '../composables/useLlmProfile.js';

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  menuKey: { type: String, default: '' },
});

const profiles = ref([]);
const profileId = ref('');
const defaultProfileId = ref('');
const loading = ref(true);

const selectedLabel = computed(() => {
  const hit = profiles.value.find(p => p.id === profileId.value);
  return hit?.label || profileId.value;
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

onMounted(async () => {
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
.llm-profile-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.llm-profile-bar.collapsed {
  flex-direction: column;
  padding: 8px 4px;
  gap: 4px;
}

.llm-profile-label {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  white-space: nowrap;
}

.llm-profile-icon {
  color: rgba(255, 255, 255, 0.85);
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
  background: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.llm-profile-select :deep(.el-select__placeholder),
.llm-profile-select :deep(.el-select__selected-item) {
  color: #fff;
  font-size: 12px;
}
</style>
