<template>
  <el-container :class="['cartoon-sub-layout', { embedded }]">
    <NavMenu v-if="!embedded" :embedded="embedded" />
    <el-container :class="['cartoon-sub-main-column', { embedded }]" direction="vertical">
      <div v-if="embedded" class="cartoon-sub-embedded-bar">
        <NavMenu :embedded="embedded" />
      </div>
      <el-main :class="['cartoon-sub-content', { embedded }]">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { isQiankunEmbedded } from '../services/apiConfig.js';
import { refreshAccess } from '../lib/appAccess.js';
import NavMenu from './NavMenu.vue';
import './MainLayout.css';

const embedded = computed(() => isQiankunEmbedded());
onMounted(() => { refreshAccess(); });
</script>
