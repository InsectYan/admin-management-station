<template>
  <el-container :class="['novel-sub-layout', { embedded }]">
    <el-header v-if="!embedded" class="novel-sub-header">
      <div class="novel-sub-title">小说创作平台</div>
      <NavMenu :embedded="embedded" />
    </el-header>
    <div v-else class="novel-sub-embedded-bar">
      <NavMenu :embedded="embedded" />
    </div>
    <el-main :class="['novel-sub-content', { embedded }]">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { isQiankunEmbedded } from '../services/apiConfig.js';
import NavMenu from './NavMenu.vue';
import './MainLayout.css';

const embedded = computed(() => isQiankunEmbedded());
</script>
