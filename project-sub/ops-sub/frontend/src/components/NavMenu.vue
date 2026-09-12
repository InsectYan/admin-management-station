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
      <el-menu-item index="/projects">
        <el-icon><Monitor /></el-icon>
        <span>项目信息</span>
      </el-menu-item>
    </el-menu>
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
    <el-menu-item index="/projects">
      <el-icon><Monitor /></el-icon>
      <span>项目信息</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Monitor, Fold, Expand } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '运维管理平台' },
});

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));
const activePath = computed(() => (
  route.path.startsWith('/projects') ? '/projects' : route.path
));
</script>
