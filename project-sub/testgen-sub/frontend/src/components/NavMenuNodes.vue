<template>
  <el-menu-item
    v-for="node in leafNodes"
    :key="node.path"
    :index="node.path"
  >
    <el-icon v-if="node.icon"><component :is="iconMap[node.icon]" /></el-icon>
    <span>{{ node.title }}</span>
  </el-menu-item>
  <el-sub-menu
    v-for="node in branchNodes"
    :key="node.index"
    :index="node.index"
  >
    <template #title>
      <el-icon v-if="node.icon"><component :is="iconMap[node.icon]" /></el-icon>
      <span>{{ node.title }}</span>
    </template>
    <NavMenuNodes :nodes="node.children" />
  </el-sub-menu>
</template>

<script setup>
import { computed } from 'vue';
import { Aim, DataAnalysis, FolderOpened, Setting } from '@element-plus/icons-vue';

defineOptions({ name: 'NavMenuNodes' });

const props = defineProps({
  nodes: { type: Array, required: true },
});

const iconMap = { Aim, DataAnalysis, FolderOpened, Setting };
const leafNodes = computed(() => props.nodes.filter(node => node.path));
const branchNodes = computed(() => props.nodes.filter(node => !node.path));
</script>
