<template>
  <el-aside v-if="!embedded" :width="asideWidth" :class="['cartoon-sub-sider', { collapsed }]">
    <div class="cartoon-sub-brand">
      <span v-show="!collapsed" class="cartoon-sub-brand-text">漫剧</span>
      <el-tooltip :content="collapsed ? '展开菜单' : '折叠菜单'" placement="right">
        <el-button class="cartoon-collapse" link :aria-label="collapsed ? '展开菜单' : '折叠菜单'" @click="toggleCollapsed">
          <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
        </el-button>
      </el-tooltip>
    </div>
    <el-menu
      class="cartoon-sub-nav"
      :collapse="collapsed"
      :collapse-transition="false"
      :default-active="active"
      background-color="transparent"
      text-color="#2c4336"
      active-text-color="#2f8a5b"
      router
    >
      <el-menu-item index="/projects">
        <el-icon><Film /></el-icon>
        <span>项目</span>
      </el-menu-item>
    </el-menu>
  </el-aside>
  <el-menu
    v-else
    class="cartoon-sub-nav embedded"
    mode="horizontal"
    :default-active="active"
    background-color="transparent"
    text-color="#2c4336"
    active-text-color="#2f8a5b"
    router
  >
    <el-menu-item index="/projects">
      <el-icon><Film /></el-icon>
      <span>项目</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Expand, Fold, Film } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({ embedded: { type: Boolean, default: false } });
const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '220px'));
const active = computed(() => (route.path.startsWith('/projects') ? '/projects' : route.path));
</script>
