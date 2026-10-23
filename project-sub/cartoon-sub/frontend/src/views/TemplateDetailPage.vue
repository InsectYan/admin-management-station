<template>
  <PageShell :title="detail?.name || '模板'">
    <el-empty v-if="missing" description="模板不存在" />
    <div v-else-if="detail" class="cartoon-module">
      <p>{{ detail.scene }}</p>
      <el-tag size="small">{{ detail.content_label }}</el-tag>
      <el-tag size="small" effect="plain">{{ detail.stage_label }}</el-tag>
      <p v-if="detail.needs_package">创建后需要钉扎故事包。</p>
      <p v-else>创建后使用本地文案，不绑定小说。</p>
      <router-link to="/templates">返回模板列表</router-link>
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
    detail.value = await request(`/video-templates/${route.params.id}`);
  } catch (err) {
    missing.value = true;
  }
});
</script>
