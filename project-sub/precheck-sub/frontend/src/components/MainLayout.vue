<template>
  <div class="shell" :class="{ embedded }">
    <aside v-if="!embedded" class="sider">
      <div class="brand">预检</div>
      <el-menu :default-active="route.path" router background-color="transparent">
        <el-menu-item index="/runtimes">运行时</el-menu-item>
        <el-menu-item index="/workflows">工作流</el-menu-item>
      </el-menu>
    </aside>
    <div class="content">
      <el-menu v-if="embedded" mode="horizontal" :default-active="route.path" router>
        <el-menu-item index="/runtimes">运行时</el-menu-item>
        <el-menu-item index="/workflows">工作流</el-menu-item>
      </el-menu>
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { isQiankunEmbedded } from '../services/apiConfig.js';

const route = useRoute();
const embedded = computed(() => isQiankunEmbedded());
</script>
