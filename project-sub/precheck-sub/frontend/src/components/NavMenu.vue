<template>
  <el-aside v-if="!embedded" :width="asideWidth" :class="['precheck-sub-sider', { collapsed }]">
    <div class="precheck-sub-brand">
      <span v-show="!collapsed" class="precheck-sub-brand-text">预检</span>
      <el-tooltip :content="collapsed ? '展开菜单' : '折叠菜单'" placement="right">
        <el-button class="precheck-collapse" link :aria-label="collapsed ? '展开菜单' : '折叠菜单'" @click="toggleCollapsed">
          <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
        </el-button>
      </el-tooltip>
    </div>
    <el-menu
      class="precheck-sub-nav"
      :collapse="collapsed"
      :collapse-transition="false"
      :default-active="route.path"
      background-color="transparent"
      text-color="#2c4336"
      active-text-color="#2f8a5b"
      router
    >
      <el-menu-item index="/runtimes">
        <el-icon><Monitor /></el-icon>
        <span>运行时</span>
      </el-menu-item>
      <el-menu-item index="/workflows">
        <el-icon><Share /></el-icon>
        <span>工作流</span>
      </el-menu-item>
    </el-menu>
  </el-aside>
  <el-menu
    v-else
    class="precheck-sub-nav embedded"
    mode="horizontal"
    :default-active="route.path"
    background-color="transparent"
    text-color="#2c4336"
    active-text-color="#2f8a5b"
    router
  >
    <el-menu-item index="/runtimes">
      <el-icon><Monitor /></el-icon>
      <span>运行时</span>
    </el-menu-item>
    <el-menu-item index="/workflows">
      <el-icon><Share /></el-icon>
      <span>工作流</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Expand, Fold, Monitor, Share } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({ embedded: { type: Boolean, default: false } });
const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '220px'));
</script>
