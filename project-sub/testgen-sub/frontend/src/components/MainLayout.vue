<template>
  <el-container :class="['testgen-sub-layout', { embedded }]">
    <el-header v-if="!embedded" class="testgen-sub-header">
      <div class="testgen-sub-title">AI智能测试平台</div>
      <NavMenu :embedded="embedded" />
    </el-header>
    <div v-else class="testgen-sub-embedded-bar">
      <NavMenu :embedded="embedded" />
    </div>
    <el-main :class="['testgen-sub-content', { embedded }]">
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
