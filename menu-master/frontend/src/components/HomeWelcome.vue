<template>
  <div v-if="redirecting" />
  <div v-else class="welcome-panel">
    <el-empty description="">
      <template #description>
        <h4 class="welcome-title">欢迎使用私人管理平台</h4>
        <p class="welcome-desc">暂无可用菜单，请先在数据库中配置 menu_items。</p>
      </template>
    </el-empty>
  </div>
</template>

<script setup>
import { inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { buildMenuPath } from '../qiankun/config.js';

const router = useRouter();
const rootMenus = inject('rootMenus', ref([]));
const redirecting = ref(false);

watch(rootMenus, roots => {
  const first = roots.find(m => m.status === 'enabled');
  if (first && !redirecting.value) {
    redirecting.value = true;
    router.replace(buildMenuPath(first.route_prefix));
  }
}, { immediate: true });
</script>

<style scoped>
.welcome-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.welcome-desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}
</style>
