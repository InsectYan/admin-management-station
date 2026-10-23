<template>
  <PageShell title="审核详情">
    <el-empty v-if="missing" description="审核记录不存在" />
    <div v-else-if="detail">
      <p>{{ detail.project_name }} · {{ detail.decision === 'pass' ? '通过' : '驳回' }} · {{ detail.node }}</p>
      <p v-if="detail.note">{{ detail.note }}</p>
      <router-link :to="`/projects/${detail.project_id}`">回到项目</router-link>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';

const route = useRoute();
const detail = ref(null);
const missing = ref(false);
onMounted(async () => {
  try {
    detail.value = await request(`/library/reviews/${route.params.id}`);
  } catch (err) {
    missing.value = true;
  }
});
</script>
