<template>
  <el-menu
    :class="['novel-sub-nav', { embedded }]"
    mode="horizontal"
    :default-active="activeKey"
    :background-color="embedded ? '#fff' : 'transparent'"
    :text-color="embedded ? '#303133' : '#fff'"
    :active-text-color="embedded ? '#409eff' : '#fff'"
    router
  >
    <el-menu-item index="/novels">
      <el-icon><Reading /></el-icon>
      <span>小说管理</span>
    </el-menu-item>
    <el-menu-item index="/agent">
      <el-icon><ChatDotRound /></el-icon>
      <span>AI 助手</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Reading, ChatDotRound } from '@element-plus/icons-vue';

defineProps({
  embedded: { type: Boolean, default: false },
});

const route = useRoute();
const activeKey = computed(() => (route.path.includes('/agent') ? '/agent' : '/novels'));
</script>
