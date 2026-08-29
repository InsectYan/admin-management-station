<template>
  <div :class="['media-profile-bar', { collapsed }]">
    <el-tooltip
      v-if="collapsed"
      :content="selectedHint || '选择多模态模型'"
      placement="right"
    >
      <el-icon class="media-profile-icon"><Picture /></el-icon>
    </el-tooltip>
    <span v-show="!collapsed" class="media-profile-label">多模态</span>
    <el-select
      v-model="profileId"
      :placeholder="loading ? '加载中…' : '图片/视频模型'"
      :loading="loading"
      :disabled="loading || !profiles.length"
      :class="['media-profile-select', { collapsed }]"
      size="small"
      popper-class="media-profile-popper"
      @change="onProfileChange"
    >
      <el-option
        v-for="p in profiles"
        :key="p.id"
        :label="optionLabel(p)"
        :value="p.id"
      >
        <div class="media-option">
          <span class="media-option__name">{{ p.label }}</span>
          <span class="media-option__caps">
            <el-tag
              v-for="c in p.capabilities"
              :key="c.id"
              size="small"
              :type="capabilityTagType(c.id)"
              effect="plain"
            >
              {{ c.label }}
            </el-tag>
            <el-tag v-if="!p.generate_ready" size="small" type="info" effect="plain">待接通</el-tag>
          </span>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Picture } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { fetchMediaProfiles } from '../services/mediaService.js';
import {
  persistMediaProfileForMenu,
  readMediaProfileId,
  syncMediaProfileForMenuChange,
} from '../composables/useMediaProfile.js';

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  menuKey: { type: String, default: '' },
});

const profiles = ref([]);
const profileId = ref('');
const defaultProfileId = ref('');
const loading = ref(true);

const selectedHint = computed(() => {
  const hit = profiles.value.find(p => p.id === profileId.value);
  if (!hit) return profileId.value;
  const caps = (hit.capabilities || []).map(c => c.label).join('、');
  return caps ? `${hit.label} · ${caps}` : hit.label;
});

function optionLabel(p) {
  const caps = (p.capabilities || []).map(c => c.label).join('/');
  const suffix = p.available ? '' : '（不可用）';
  return caps ? `${p.label} · ${caps}${suffix}` : `${p.label}${suffix}`;
}

function capabilityTagType(id) {
  if (id === 'image' || id === 'image_edit') return 'success';
  if (id === 'video') return 'warning';
  return 'info';
}

function applyInitialProfile() {
  const stored = readMediaProfileId();
  if (stored && profiles.value.some(p => p.id === stored)) {
    profileId.value = stored;
    return;
  }
  const fallback = profiles.value.find(p => p.id === defaultProfileId.value && p.available)
    || profiles.value.find(p => p.available)
    || profiles.value.find(p => p.id === defaultProfileId.value)
    || profiles.value[0];
  if (fallback) {
    profileId.value = fallback.id;
    persistMediaProfileForMenu(props.menuKey, fallback.id);
  }
}

function onProfileChange(id) {
  persistMediaProfileForMenu(props.menuKey, id);
}

onMounted(async () => {
  try {
    const data = await fetchMediaProfiles();
    profiles.value = data.profiles || [];
    defaultProfileId.value = data.default_profile_id || '';
    applyInitialProfile();
  } catch {
    ElMessage.warning('无法加载多模态模型，请确认 Agent 平台已启动');
  } finally {
    loading.value = false;
  }
});

watch(
  () => props.menuKey,
  (nextKey, prevKey) => {
    if (!nextKey || nextKey === prevKey) return;
    const next = syncMediaProfileForMenuChange(prevKey, nextKey, profileId.value);
    if (next && profiles.value.some(p => p.id === next)) {
      profileId.value = next;
    }
  },
);
</script>

<style scoped>
.media-profile-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.media-profile-bar.collapsed {
  flex-direction: column;
  padding: 8px 4px;
  gap: 4px;
}

.media-profile-label {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  white-space: nowrap;
}

.media-profile-icon {
  color: rgba(255, 255, 255, 0.85);
  font-size: 18px;
}

.media-profile-select {
  flex: 1;
  min-width: 0;
}

.media-profile-select.collapsed {
  width: 52px;
}

.media-profile-select :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.media-profile-select :deep(.el-select__placeholder),
.media-profile-select :deep(.el-select__selected-item) {
  color: #fff;
  font-size: 12px;
}

.media-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.media-option__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-option__caps {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}
</style>

<style>
.media-profile-popper {
  min-width: 320px;
}

.media-profile-popper .media-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
