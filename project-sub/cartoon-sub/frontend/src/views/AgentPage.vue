<template>
  <PageShell title="Agent">
    <p class="cartoon-module__hint">这里查看各内容类型已经保存的角色参数。没有 Skill 的角色不能启用。修改仍在流水线页完成。</p>
    <el-select v-model="contentType" style="width: 180px" @change="load">
      <el-option v-for="item in CONTENT_TYPES" :key="item.id" :label="item.label" :value="item.id" />
    </el-select>
    <el-table :data="agents" class="cartoon-agent-table">
      <el-table-column prop="label" label="角色" />
      <el-table-column prop="skill_name" label="Skill" />
      <el-table-column prop="model_profile" label="模型档位" />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">{{ row.enabled ? '是' : '否' }}</template>
      </el-table-column>
    </el-table>
    <router-link :to="`/pipelines/${contentType}`">去流水线调整</router-link>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { CONTENT_TYPES } from '../lib/contentTypes.js';

const route = useRoute();
const contentType = ref(route.params.contentType || 'ai_comic');
const agents = ref([]);
async function load() {
  try {
    const data = await request('/pipelines', { params: { content_type: contentType.value } });
    agents.value = data.agents || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(load);
</script>

<style scoped>
.cartoon-agent-table { margin: 16px 0; }
</style>
