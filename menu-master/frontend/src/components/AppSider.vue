<template>
  <el-aside width="240px" class="app-sider">
    <div class="app-brand">
      <span class="app-brand-text">私人管理平台</span>
    </div>
    <div v-if="loading" class="menu-status">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>菜单加载中…</span>
    </div>
    <el-alert
      v-else-if="error"
      class="menu-alert"
      type="error"
      :title="error"
      show-icon
      :closable="false"
    />
    <el-menu
      v-else
      background-color="#001529"
      text-color="#ffffffa6"
      active-text-color="#fff"
      :default-active="selectedKey"
      :default-openeds="openKeys"
      @select="handleSelect"
    >
      <template v-for="item in menuItems" :key="item.key">
        <el-sub-menu v-if="item.children?.length" :index="item.key">
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
        <el-menu-item v-else :index="item.key">
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
import { Loading, Grid, Reading } from '@element-plus/icons-vue';
import { buildMenuPath } from '../qiankun/config.js';

const props = defineProps({
  menus: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
});

const route = useRoute();
const router = useRouter();

const ICON_MAP = {
  'icon-novel': Reading,
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
  background: #001529;
  min-height: 100vh;
}

.app-brand-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
</style>
