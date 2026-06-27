<template>
  <el-aside :width="asideWidth" :class="['app-sider', { collapsed }]">
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
      background-color="#545c64"
      text-color="#fff"
      active-text-color="#ffd04b"
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
  </el-aside>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loading, Grid, Reading, Cpu, Fold, Expand } from '@element-plus/icons-vue';
import { buildMenuPath } from '../qiankun/config.js';
import { useNavCollapse } from '../composables/useNavCollapse.js';
import LlmProfileSelector from './LlmProfileSelector.vue';

const props = defineProps({
  menus: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
});

const route = useRoute();
const router = useRouter();
const { collapsed, toggleCollapsed } = useNavCollapse();

const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));

const ICON_MAP = {
  'icon-novel': Reading,
  'icon-testgen': Cpu,
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

const menuItems = computed(() => toMenuItems(props.menus));
const selectedKey = computed(() => findSelectedKey(route.path, props.menus));
const openKeys = computed(() => findOpenKeys(route.path, props.menus));

function handleSelect(key) {
  router.push(key);
}
</script>

<style scoped>
.app-sider {
  background: #545c64;
  min-height: 100vh;
  transition: width 0.25s ease;
  overflow: hidden;
}

.app-brand {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  padding-left: 20px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-sider.collapsed .menu-status {
  justify-content: center;
  padding-inline: 8px;
}

.collapse-trigger {
  color: rgba(255, 255, 255, 0.85);
  font-size: 18px;
}

.collapse-trigger:hover {
  color: #ffd04b;
}
</style>
