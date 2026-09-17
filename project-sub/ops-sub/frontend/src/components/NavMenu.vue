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
      <el-menu-item v-for="item in navMenus" :key="item.path" :index="item.path">
        <el-icon><component :is="iconOf(item.icon)" /></el-icon>
        <span>{{ item.title }}</span>
      </el-menu-item>
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
    <el-menu-item v-for="item in navMenus" :key="item.path" :index="item.path">
      <el-icon><component :is="iconOf(item.icon)" /></el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Clock, Expand, Fold, Monitor } from '@element-plus/icons-vue';
import { navMenus } from '../config/navMenu.js';
import { useNavCollapse } from '../composables/useNavCollapse.js';
import { getCachedUser } from '../lib/amsAuth.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '运维管理平台' },
});

const ICONS = { Monitor, Clock };
function iconOf(name) {
  return ICONS[name] || Monitor;
}

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
const activePath = computed(() => (
  route.path.startsWith('/deploy-jobs') ? '/deploy-jobs' : '/projects'
));
const userName = computed(() => getCachedUser()?.username || '');
</script>
