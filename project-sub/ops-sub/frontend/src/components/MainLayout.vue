<template>
  <el-container :class="['ops-sub-layout', { embedded }]">
    <NavMenu
      v-if="!embedded"
      :embedded="embedded"
      title="运维管理平台"
    />
    <el-container
      :class="['ops-sub-main-column', { embedded }]"
      direction="vertical"
    >
      <div v-if="embedded" class="ops-sub-embedded-bar">
        <NavMenu :embedded="embedded" />
      </div>
      <el-main :class="['ops-sub-content', { embedded }, sceneClass]">
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
  if (route.name === 'ops-list') return 'ops-scene ops-scene--meadow';
  if (route.name === 'ops-detail') return 'ops-scene ops-scene--lake';
  return 'ops-scene ops-scene--grove';
});
</script>
