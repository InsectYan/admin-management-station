<template>
  <div class="shell" :class="{ embedded }">
    <aside v-if="!embedded" class="sider">
      <div class="brand">漫剧</div>
      <el-menu :default-active="active" router background-color="transparent">
        <el-menu-item index="/projects">项目</el-menu-item>
      </el-menu>
    </aside>
    <div class="content">
      <el-menu v-if="embedded" mode="horizontal" :default-active="active" router>
        <el-menu-item index="/projects">项目</el-menu-item>
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
const active = computed(() => (route.path.startsWith('/projects') ? '/projects' : route.path));
</script>
