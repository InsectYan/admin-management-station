<template>
  <el-aside
    v-if="!embedded"
    :width="asideWidth"
    :class="['ops-sub-sider', { collapsed }]"
  >
    <div class="ops-sub-brand">
      <span v-show="!collapsed" class="ops-sub-brand-text">{{ title }}</span>
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
      class="ops-sub-nav"
      :collapse="collapsed"
      :collapse-transition="false"
      :default-active="activePath"
      background-color="transparent"
      text-color="#2c4336"
      active-text-color="#2f8a5b"
      router
    >
      <el-menu-item-group v-for="group in visibleGroups" :key="group.title">
        <template v-if="!collapsed" #title>{{ group.title }}</template>
        <el-menu-item v-for="item in group.items" :key="item.path" :index="item.path">
          <el-icon><component :is="iconOf(item.icon)" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu-item-group>
    </el-menu>
    <div v-if="userName" class="ops-sub-user">{{ userName }}</div>
  </el-aside>
  <el-menu
    v-else
    :class="['ops-sub-nav', { embedded }]"
    mode="horizontal"
    :default-active="activePath"
    background-color="transparent"
    text-color="#2c4336"
    active-text-color="#2f8a5b"
    router
  >
    <el-menu-item v-for="item in flatMenus" :key="item.path" :index="item.path">
      <el-icon><component :is="iconOf(item.icon)" /></el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Bell, Clock, Coin, Connection, Cpu, DataLine, Expand, Fold, List, Monitor, Notebook, Odometer, Setting, Share, Warning } from '@element-plus/icons-vue';
import { navGroups } from '../config/navMenu.js';
import { useNavCollapse } from '../composables/useNavCollapse.js';
import { getCachedUser } from '../lib/amsAuth.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '运维管理平台' },
});

const ICONS = { Monitor, Clock, Odometer, List, Connection, Bell, Notebook, Setting, Warning, Coin, Cpu, DataLine, Share };
function iconOf(name) {
  return ICONS[name] || Monitor;
}

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
const isAdmin = computed(() => {
  const user = getCachedUser();
  return user?.account_type === 'super_admin' || user?.role === 'admin';
});
const visibleGroups = computed(() => navGroups.map(group => ({
  ...group,
  items: group.items.filter(item => !item.adminOnly || isAdmin.value),
})));
const flatMenus = computed(() => visibleGroups.value.flatMap(group => group.items));
const CONTENT_PATHS = [ '/overview', '/jobs', '/deps', '/alerts', '/audit', '/settings' ];
const activePath = computed(() => {
  const content = CONTENT_PATHS.find(path => route.path === path || route.path.startsWith(`${path}/`));
  if (content) return content;
  if (route.path.startsWith('/deploy-jobs')) return '/deploy-jobs';
  return '/projects';
});
const userName = computed(() => getCachedUser()?.username || '');
</script>
