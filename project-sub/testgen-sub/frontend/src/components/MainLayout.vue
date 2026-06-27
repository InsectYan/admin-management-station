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
      <el-main :class="['testgen-sub-content', { embedded }]">
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
