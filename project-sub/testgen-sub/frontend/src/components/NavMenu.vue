<template>
  <el-aside
    v-if="!embedded"
    :width="asideWidth"
    :class="['testgen-sub-sider', { collapsed }]"
  >
    <div class="testgen-sub-brand">
      <span v-show="!collapsed" class="testgen-sub-brand-text">{{ title }}</span>
      <el-tooltip
        :content="collapsed ? '展开菜单' : '折叠菜单'"
        placement="right"
      >
        <el-button
          class="collapse-trigger"
          link
          :aria-label="collapsed ? '展开菜单' : '折叠菜单'"
          @click="toggleCollapsed"
        >
          <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
        </el-button>
      </el-tooltip>
    </div>
    <el-menu
      class="testgen-sub-nav"
      :collapse="collapsed"
      :collapse-transition="false"
      :default-active="activePath"
      background-color="#409eff"
      text-color="#fff"
      active-text-color="#ffd04b"
      router
    >
      <el-menu-item index="/scope">
        <el-icon><Aim /></el-icon>
        <span>生成测试用例</span>
      </el-menu-item>
      <el-menu-item index="/suite">
        <el-icon><List /></el-icon>
        <span>测试用例管理</span>
      </el-menu-item>
    </el-menu>
  </el-aside>
  <el-menu
    v-else
    :class="['testgen-sub-nav', { embedded }]"
    mode="horizontal"
    :default-active="activePath"
    background-color="#fff"
    text-color="#303133"
    active-text-color="#409eff"
    router
  >
    <el-menu-item index="/scope">
      <el-icon><Aim /></el-icon>
      <span>生成测试用例</span>
    </el-menu-item>
    <el-menu-item index="/suite">
      <el-icon><List /></el-icon>
      <span>测试用例管理</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Aim, List, Fold, Expand } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: 'AI智能测试平台' },
});

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();

const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));

const activePath = computed(() => {
  if (route.path.startsWith('/jobs')) return '/scope';
  if (route.path.startsWith('/runs')) return '/suite';
  return route.path.startsWith('/suite') ? '/suite' : '/scope';
});
</script>
