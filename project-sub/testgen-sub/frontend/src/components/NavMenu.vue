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
      <el-menu-item index="/scope">
        <el-icon><Aim /></el-icon>
        <span>生成测试用例</span>
      </el-menu-item>
      <el-menu-item index="/suite">
        <el-icon><List /></el-icon>
        <span>测试用例管理</span>
      </el-menu-item>

      <el-sub-menu index="fitness">
        <template #title>
          <el-icon><DataAnalysis /></el-icon>
          <span>Fitness 测试体系</span>
        </template>
        <el-menu-item index="/fitness/dashboard">发版仪表盘</el-menu-item>
        <el-sub-menu index="fitness-assets">
          <template #title>测试资产</template>
          <el-menu-item index="/fitness/assets/items">测试项库</el-menu-item>
          <el-menu-item index="/fitness/assets/browse">分类浏览</el-menu-item>
          <el-menu-item index="/fitness/assets/schemes">方案百科</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="fitness-insights">
          <template #title>洞察分析</template>
          <el-menu-item index="/fitness/insights/metrics/dimensions">指标中心</el-menu-item>
          <el-menu-item index="/fitness/insights/analysis/readiness">分析中心</el-menu-item>
          <el-menu-item index="/fitness/insights/risks">风险中心</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="fitness-plans">
          <template #title>测试计划</template>
          <el-menu-item index="/fitness/plans">计划列表</el-menu-item>
          <el-menu-item index="/fitness/plans/new">计划向导</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="fitness-exec">
          <template #title>执行层</template>
          <el-menu-item index="/fitness/execution/environments">环境配置</el-menu-item>
          <el-menu-item index="/fitness/execution/samples">样本集</el-menu-item>
          <el-menu-item index="/fitness/execution/center">执行中心</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/fitness/settings/enums">枚举配置</el-menu-item>
      </el-sub-menu>
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
    <el-menu-item index="/scope">
      <el-icon><Aim /></el-icon>
      <span>生成测试用例</span>
    </el-menu-item>
    <el-menu-item index="/suite">
      <el-icon><List /></el-icon>
      <span>测试用例管理</span>
    </el-menu-item>
    <el-sub-menu index="fitness-h">
      <template #title>Fitness 测试体系</template>
      <el-menu-item index="/fitness/dashboard">仪表盘</el-menu-item>
      <el-menu-item index="/fitness/assets/items">测试项库</el-menu-item>
      <el-menu-item index="/fitness/plans">测试计划</el-menu-item>
      <el-menu-item index="/fitness/execution/center">执行中心</el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Aim, List, Fold, Expand, DataAnalysis } from '@element-plus/icons-vue';
import { useNavCollapse } from '../composables/useNavCollapse.js';

defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: 'AI智能测试平台' },
});

const route = useRoute();
const { collapsed, toggleCollapsed } = useNavCollapse();

const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));

const activePath = computed(() => {
  if (route.path.startsWith('/jobs')) return '/scope';
  if (route.path.startsWith('/runs') && !route.path.startsWith('/fitness')) return '/suite';
  if (route.path.startsWith('/fitness')) {
    if (route.path.startsWith('/fitness/assets')) return route.path.startsWith('/fitness/assets/items/') ? '/fitness/assets/items' : route.path.split('/').slice(0, 4).join('/') || '/fitness/assets/items';
    if (route.path.startsWith('/fitness/insights/metrics')) return '/fitness/insights/metrics/dimensions';
    if (route.path.startsWith('/fitness/insights/analysis')) return '/fitness/insights/analysis/readiness';
    if (route.path.startsWith('/fitness/insights/risks')) return '/fitness/insights/risks';
    if (route.path.startsWith('/fitness/plans')) return route.path.includes('/new') ? '/fitness/plans/new' : '/fitness/plans';
    if (route.path.startsWith('/fitness/execution')) return '/fitness/execution/center';
    if (route.path.startsWith('/fitness/settings')) return '/fitness/settings/enums';
    return '/fitness/dashboard';
  }
  return route.path.startsWith('/suite') ? '/suite' : '/scope';
});
</script>
