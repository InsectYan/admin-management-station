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
        <router-view :key="viewKey" />
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
/** 仅路径实体变化时重挂载；query（如 tab）变化不重建页面，避免切 tab / 返回时报错 */
const viewKey = computed(() => {
  const id = route.params.id != null ? String(route.params.id) : '';
  const jobId = route.params.jobId != null ? String(route.params.jobId) : '';
  return [ String(route.name || ''), id, jobId ].filter(Boolean).join(':');
});
const sceneClass = computed(() => {
  if (route.name === 'ops-list' || route.name === 'ops-deploy-history' || route.name === 'ops-deploy-jobs') {
    return 'ops-scene ops-scene--meadow';
  }
  if (route.name === 'ops-detail' || route.name === 'ops-edit') return 'ops-scene ops-scene--lake';
  if (route.name === 'ops-create') return 'ops-scene ops-scene--grove';
  if (route.name === 'ops-deploy') return 'ops-scene ops-scene--dusk';
  if (route.name === 'ops-deploy-log') return 'ops-scene ops-scene--night';
  return 'ops-scene ops-scene--grove';
});
</script>
