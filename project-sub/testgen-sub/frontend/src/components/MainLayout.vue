<template>
  <el-container :class="['testgen-sub-layout', { embedded }]">
    <NavMenu
      v-if="!embedded"
      :embedded="embedded"
      title="AI智能测试平台"
    />
    <el-container
      :class="['testgen-sub-main-column', { embedded }]"
      direction="vertical"
    >
      <div v-if="embedded" class="testgen-sub-embedded-bar">
        <NavMenu :embedded="embedded" />
      </div>
      <el-main :class="['testgen-sub-content', { embedded }, sceneClass]">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { isQiankunEmbedded } from '../services/apiConfig.js';
import NavMenu from './NavMenu.vue';
import './MainLayout.css';

const embedded = computed(() => isQiankunEmbedded());
const route = useRoute();
const sceneClass = computed(() => {
  const path = route.path || '';
  if (path.startsWith('/projects')) return 'testgen-scene testgen-scene--meadow';
  if (path.startsWith('/fitness/insights') || path.startsWith('/fitness/dashboard') || path.startsWith('/fitness/topics')) {
    return 'testgen-scene testgen-scene--lake';
  }
  if (path.startsWith('/testgen') || path.startsWith('/jobs') || path.startsWith('/config')) {
    return 'testgen-scene testgen-scene--grove';
  }
  return 'testgen-scene testgen-scene--grove';
});
</script>
