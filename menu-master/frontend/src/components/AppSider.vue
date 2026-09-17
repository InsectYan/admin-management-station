<template>
  <el-aside :width="asideWidth" :class="['app-sider', { collapsed }]">
    <AppVineDecor />
    <div class="app-brand">
      <span v-show="!collapsed" class="app-brand-text">私人管理平台</span>
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
    <LlmProfileSelector
      :collapsed="collapsed"
      :menu-key="selectedKey"
    />
    <MediaProfileSelector
      :collapsed="collapsed"
      :menu-key="selectedKey"
    />
    <div v-if="loading" class="menu-status">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span v-show="!collapsed">菜单加载中…</span>
    </div>
    <el-alert
      v-else-if="error"
      class="menu-alert"
      type="error"
      :title="collapsed ? '菜单加载失败' : error"
      show-icon
      :closable="false"
    />
    <el-menu
      v-else
      background-color="transparent"
      text-color="#2c4336"
      active-text-color="#2f8a5b"
      :collapse="collapsed"
      :collapse-transition="false"
      :default-active="selectedKey"
      :default-openeds="openKeys"
      @select="handleSelect"
    >
      <template v-for="item in menuItems">
        <el-sub-menu
          v-if="item.children?.length"
          :key="`sub-${item.key}`"
          :index="item.key"
        >
          <template #title>
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </template>
          <el-menu-item
            v-for="child in item.children"
            :key="child.key"
            :index="child.key"
          >
            <el-icon><component :is="child.icon" /></el-icon>
            <span>{{ child.label }}</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item
          v-else
          :key="`item-${item.key}`"
          :index="item.key"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </template>
    </el-menu>
    <div class="app-user">
      <span v-show="!collapsed" class="app-user-name">{{ displayName }}</span>
      <el-button link type="primary" @click="router.push('/settings')">设置</el-button>
      <el-button link type="primary" @click="onLogout">退出</el-button>
    </div>
  </el-aside>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loading, Grid, Reading, Cpu, Monitor, Fold, Expand, User, Document } from '@element-plus/icons-vue';
import { buildMenuPath } from '../qiankun/config.js';
import { useNavCollapse } from '../composables/useNavCollapse.js';
import { clearSession, getCachedUser, isAdmin } from '../lib/amsAuth.js';
import { logout } from '../services/authService.js';
import LlmProfileSelector from './LlmProfileSelector.vue';
import MediaProfileSelector from './MediaProfileSelector.vue';
import AppVineDecor from './AppVineDecor.vue';

const props = defineProps({
  menus: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
});

const route = useRoute();
const router = useRouter();
const { collapsed, toggleCollapsed } = useNavCollapse();

const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
const cachedUser = computed(() => getCachedUser());
const displayName = computed(() => cachedUser.value?.username || '已登录');
const adminMenus = [
  { key: '/users', icon: User, label: '用户管理' },
  { key: '/audit', icon: Document, label: '审计日志' },
];

async function onLogout() {
  await logout();
  clearSession();
  router.replace('/login');
}

const ICON_MAP = {
  'icon-novel': Reading,
  'icon-testgen': Cpu,
  'icon-ops': Monitor,
};

function resolveIcon(iconName) {
  return ICON_MAP[iconName] || Grid;
}

function toMenuItems(menus) {
  return menus.map(menu => ({
    key: buildMenuPath(menu.route_prefix),
    icon: resolveIcon(menu.icon),
    label: menu.name,
    children: menu.children?.length ? toMenuItems(menu.children) : undefined,
  }));
}

function findSelectedKey(pathname, menus) {
  let best = '';

  function walk(items) {
    for (const menu of items) {
      const path = buildMenuPath(menu.route_prefix);
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        if (path.length >= best.length) {
          best = path;
        }
      }
      if (menu.children?.length) {
        walk(menu.children);
      }
    }
  }

  walk(menus);
  return best;
}

function findOpenKeys(pathname, menus, keys = []) {
  for (const menu of menus) {
    const path = buildMenuPath(menu.route_prefix);
    if (!menu.children?.length) {
      continue;
    }
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      keys.push(path);
      findOpenKeys(pathname, menu.children, keys);
    }
  }
  return keys;
}

const menuItems = computed(() => {
  const items = toMenuItems(props.menus);
  if (isAdmin(cachedUser.value)) items.push(...adminMenus);
  return items;
});
const selectedKey = computed(() => {
  if ([ '/users', '/audit', '/settings' ].includes(route.path)) return route.path;
  return findSelectedKey(route.path, props.menus);
});
const openKeys = computed(() => findOpenKeys(route.path, props.menus));

function handleSelect(key) {
  router.push(key);
}
</script>

<style scoped>
.app-sider {
  position: relative;
  background:
    linear-gradient(180deg, #eef6f0 0%, #e4f0e8 100%);
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.25s ease;
  overflow: hidden;
  box-shadow: inset -1px 0 0 rgba(47, 138, 91, 0.12);
}

.app-sider > *:not(.app-vine) {
  position: relative;
  z-index: 1;
}

.app-sider :deep(.el-menu) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-right: none;
  background: transparent;
}

.app-sider :deep(.el-menu-item.is-active) {
  background: rgba(47, 138, 91, 0.12) !important;
}

.app-sider :deep(.el-menu-item:hover),
.app-sider :deep(.el-sub-menu__title:hover) {
  background: rgba(47, 138, 91, 0.08) !important;
}

.app-brand {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  padding-left: 20px;
  color: #1f3d2c;
  border-bottom: 1px solid rgba(47, 138, 91, 0.14);
}

.app-sider.collapsed .menu-status {
  justify-content: center;
  padding-inline: 8px;
}

.collapse-trigger {
  color: #5c6b62;
  font-size: 18px;
}

.collapse-trigger:hover {
  color: #2f8a5b;
}
</style>
