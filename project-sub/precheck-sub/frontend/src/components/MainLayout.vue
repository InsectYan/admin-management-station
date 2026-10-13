<template>
  <el-container :class="['precheck-sub-layout', { embedded }]">
    <NavMenu v-if="!embedded" />
    <el-container :class="['precheck-sub-main-column', { embedded }]" direction="vertical">
      <div v-if="embedded" class="precheck-sub-embedded-bar">
        <NavMenu embedded />
      </div>
      <el-main :class="['precheck-sub-content', { embedded }]">
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
