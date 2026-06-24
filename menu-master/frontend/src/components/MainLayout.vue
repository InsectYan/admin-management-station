<template>
  <el-container class="app-layout">
    <AppSider
      :menus="menus"
      :loading="loading"
      :error="error"
    />
    <el-container>
      <el-main class="app-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { provide, watch } from 'vue';
import AppSider from './AppSider.vue';
import { useMenus } from '../composables/useMenus.js';
import { registerSubApps } from '../qiankun/registerApps.js';

const { menus, rootMenus, loading, error } = useMenus();

provide('rootMenus', rootMenus);

watch(rootMenus, roots => {
  if (roots.length > 0) {
    registerSubApps(roots);
  }
}, { immediate: true });
</script>
