<template>
  <div>
    <h2 class="page-title">漫剧项目</h2>
    <el-card class="card-gap">
      <el-input v-model="name" placeholder="项目名称" style="width: 240px; margin-right: 8px" />
      <el-button type="primary" @click="create">新建</el-button>
    </el-card>
    <el-table :data="rows" @row-click="open">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="source_novel_id" label="小说 ID" />
      <el-table-column prop="status" label="状态" width="120" />
    </el-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { request } from '../services/apiConfig.js';

const router = useRouter();
const rows = ref([]);
const name = ref('');

async function load() { rows.value = await request('/projects'); }
async function create() {
  if (!name.value.trim()) return;
  const row = await request('/projects', { method: 'post', data: { name: name.value.trim() } });
  name.value = '';
  router.push(`/projects/${row.id}`);
}
function open(row) { router.push(`/projects/${row.id}`); }
onMounted(load);
</script>
