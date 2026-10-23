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
      :default-active="activePath"
      background-color="transparent"
      text-color="#2c4336"
      active-text-color="#2f8a5b"
      router
    >
      <el-menu-item v-for="item in navMenus" :key="item.path" :index="item.path">
        <el-icon><component :is="iconOf(item.icon)" /></el-icon>
        <span>{{ item.title }}</span>
      </el-menu-item>
    </el-menu>
  </el-aside>
  <el-menu
    v-else
    :class="['novel-sub-nav', { embedded }]"
    mode="horizontal"
    :default-active="activePath"
    background-color="transparent"
    text-color="#2c4336"
    active-text-color="#2f8a5b"
    router
  >
    <el-menu-item v-for="item in navMenus" :key="item.path" :index="item.path">
      <el-icon><component :is="iconOf(item.icon)" /></el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Collection, Expand, Fold, Reading, Warning } from '@element-plus/icons-vue';
import { navMenus } from '../config/navMenu.js';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '叙事工作台' },
});

const ICONS = { Reading, Warning, Collection };
function iconOf(name) {
  return ICONS[name] || Reading;
}

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
const activePath = computed(() => {
  if (route.path.startsWith('/anomalies')) return '/anomalies';
  if (route.path.startsWith('/novels')) return '/novels';
  return route.path;
});
</script>
