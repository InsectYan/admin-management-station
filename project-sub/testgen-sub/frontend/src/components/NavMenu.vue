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
      <NavMenuNodes :nodes="navMenus" />
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
    <NavMenuNodes :nodes="navMenus" />
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Fold, Expand } from '@element-plus/icons-vue';
import { navMenus } from '@/config/navMenu.js';
import { resolveNavActivePath } from '@/utils/navActivePath.js';
import { useNavCollapse } from '../composables/useNavCollapse.js';
import NavMenuNodes from './NavMenuNodes.vue';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: 'AI智能测试平台' },
});

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();

const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
const activePath = computed(() => resolveNavActivePath(route.path));
</script>
