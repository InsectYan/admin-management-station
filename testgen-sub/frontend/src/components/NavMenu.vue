<template>
  <el-menu
    :class="['testgen-sub-nav', { embedded }]"
    mode="horizontal"
    :default-active="activePath"
    :background-color="embedded ? '#fff' : 'transparent'"
    :text-color="embedded ? '#303133' : '#fff'"
    :active-text-color="embedded ? '#409eff' : '#fff'"
    router
  >
    <el-menu-item index="/scope">
      <el-icon><Aim /></el-icon>
      <span>测试范围</span>
    </el-menu-item>
    <el-menu-item index="/suite">
      <el-icon><List /></el-icon>
      <span>用例管理</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Aim, List } from '@element-plus/icons-vue';

defineProps({
  embedded: { type: Boolean, default: false },
});

const route = useRoute();
const activePath = computed(() => {
  if (route.path.startsWith('/jobs')) return '/scope';
  return route.path.startsWith('/suite') ? '/suite' : '/scope';
});
</script>
