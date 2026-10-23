<template>
  <el-aside v-if="!embedded" :width="asideWidth" :class="['cartoon-sub-sider', { collapsed }]">
    <div class="cartoon-sub-brand">
      <span v-show="!collapsed" class="cartoon-sub-brand-text">AI 视频</span>
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
      <el-menu-item index="/templates">
        <el-icon><Collection /></el-icon>
        <span>模板</span>
      </el-menu-item>
      <el-menu-item index="/pipelines">
        <el-icon><Operation /></el-icon>
        <span>流水线</span>
      </el-menu-item>
      <el-menu-item index="/rules">
        <el-icon><Notebook /></el-icon>
        <span>规则</span>
      </el-menu-item>
      <el-menu-item index="/agents">
        <el-icon><User /></el-icon>
        <span>Agent</span>
      </el-menu-item>
      <el-menu-item index="/batches">
        <el-icon><Files /></el-icon>
        <span>批量</span>
      </el-menu-item>
      <el-menu-item index="/assets/characters">
        <el-icon><Picture /></el-icon>
        <span>资产</span>
      </el-menu-item>
      <el-menu-item index="/reviews">
        <el-icon><CircleCheck /></el-icon>
        <span>审核</span>
      </el-menu-item>
      <el-menu-item index="/versions">
        <el-icon><Tickets /></el-icon>
        <span>版本</span>
      </el-menu-item>
      <el-menu-item index="/exports">
        <el-icon><Download /></el-icon>
        <span>导出</span>
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
    <el-menu-item index="/templates">
      <el-icon><Collection /></el-icon>
      <span>模板</span>
    </el-menu-item>
    <el-menu-item index="/pipelines">
      <el-icon><Operation /></el-icon>
      <span>流水线</span>
    </el-menu-item>
    <el-menu-item index="/rules">
      <el-icon><Notebook /></el-icon>
      <span>规则</span>
    </el-menu-item>
    <el-menu-item index="/agents">
      <el-icon><User /></el-icon>
      <span>Agent</span>
    </el-menu-item>
    <el-menu-item index="/batches">
      <el-icon><Files /></el-icon>
      <span>批量</span>
    </el-menu-item>
    <el-menu-item index="/assets/characters">
      <el-icon><Picture /></el-icon>
      <span>资产</span>
    </el-menu-item>
    <el-menu-item index="/reviews">
      <el-icon><CircleCheck /></el-icon>
      <span>审核</span>
    </el-menu-item>
    <el-menu-item index="/versions">
      <el-icon><Tickets /></el-icon>
      <span>版本</span>
    </el-menu-item>
    <el-menu-item index="/exports">
      <el-icon><Download /></el-icon>
      <span>导出</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Expand, Fold, Film, Collection, Operation, Notebook, User, Files, Picture, CircleCheck, Tickets, Download } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({ embedded: { type: Boolean, default: false } });
const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();
const asideWidth = computed(() => (collapsed.value ? '64px' : '220px'));
const active = computed(() => (route.path.startsWith('/projects') ? '/projects' : route.path));
</script>
