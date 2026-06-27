<template>
  <el-container :class="['novel-sub-layout', { embedded }]">
    <NavMenu
      v-if="!embedded"
      :embedded="embedded"
      title="小说创作平台"
    />
    <el-container
      :class="['novel-sub-main-column', { embedded }]"
      direction="vertical"
    >
      <div v-if="embedded" class="novel-sub-embedded-bar">
        <NavMenu :embedded="embedded" />
      </div>
      <el-main :class="['novel-sub-content', { embedded }]">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { isQiankunEmbedded } from '../services/apiConfig.js';
import NavMenu from './NavMenu.vue';
import './MainLayout.css';

const embedded = computed(() => isQiankunEmbedded());
</script>
