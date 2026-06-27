<template>
  <el-aside
    v-if="!embedded"
    :width="asideWidth"
    :class="['novel-sub-sider', { collapsed }]"
  >
    <div class="novel-sub-brand">
      <span v-show="!collapsed" class="novel-sub-brand-text">{{ title }}</span>
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
      class="novel-sub-nav"
      :collapse="collapsed"
      :collapse-transition="false"
      default-active="/novels"
      background-color="#545c64"
      text-color="#fff"
      active-text-color="#ffd04b"
      router
    >
      <el-menu-item index="/novels">
        <el-icon><Reading /></el-icon>
        <span>小说管理</span>
      </el-menu-item>
    </el-menu>
  </el-aside>
  <el-menu
    v-else
    :class="['novel-sub-nav', { embedded }]"
    mode="horizontal"
    default-active="/novels"
    background-color="#fff"
    text-color="#303133"
    active-text-color="#409eff"
    router
  >
    <el-menu-item index="/novels">
      <el-icon><Reading /></el-icon>
      <span>小说管理</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { Reading, Fold, Expand } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '小说创作平台' },
});

const { collapsed, toggleCollapsed } = useNavCollapse();

const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
</script>
