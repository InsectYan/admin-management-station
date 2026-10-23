<template>
  <p class="cartoon-module__hint cartoon-workbench__note">{{ error || '正在打开工作台…' }}</p>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { request } from '../services/apiConfig.js';

const route = useRoute();
const router = useRouter();
const error = ref('');

onMounted(async () => {
  try {
    const detail = await request(`/projects/${route.params.id}`);
    const episode = detail.episodes?.[0];
    if (!episode) {
      await router.replace(`/projects/${route.params.id}`);
      return;
    }
    const query = { node: route.meta.workbenchNode || 'input' };
    if (route.params.shotId) query.shot = String(route.params.shotId);
    await router.replace({ path: `/projects/${route.params.id}/tasks/${episode.id}`, query });
  } catch (err) {
    error.value = err.message || '打不开工作台';
  }
});
</script>

<style scoped>
.cartoon-workbench__note { margin: 16px 20px; }
</style>
