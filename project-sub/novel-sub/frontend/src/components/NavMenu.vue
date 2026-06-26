<template>
  <el-menu
    :class="['novel-sub-nav', { embedded }]"
    mode="horizontal"
    :default-active="'/novels'"
    :background-color="embedded ? '#fff' : 'transparent'"
    :text-color="embedded ? '#303133' : '#fff'"
    :active-text-color="embedded ? '#409eff' : '#fff'"
    router
  >
    <el-menu-item index="/novels">
      <el-icon><Reading /></el-icon>
      <span>小说管理</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { Reading } from '@element-plus/icons-vue';

defineProps({
  embedded: { type: Boolean, default: false },
});
</script>
