<template>
  <div>
    <p class="cartoon-module__hint">文案只存在这个视频项目里，不会在叙事工作台新建作品。</p>
    <el-form label-position="top">
      <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
      <el-form-item label="正文"><el-input v-model="form.body" type="textarea" :rows="5" /></el-form-item>
      <el-button type="primary" :disabled="!canMake()" @click="save">{{ form.id ? '保存文案' : '添加文案' }}</el-button>
      <el-button v-if="form.id" @click="reset">取消编辑</el-button>
    </el-form>
    <el-empty v-if="!blocks.length" description="还没有本地文案" />
    <el-card v-for="item in blocks" :key="item.id" shadow="never" class="cartoon-snap">
      <strong>{{ item.title || '未命名文案' }}</strong>
      <p>{{ item.body }}</p>
      <div class="cartoon-snap__actions">
        <el-button :disabled="!canMake()" @click="edit(item)">编辑</el-button>
        <el-button type="danger" plain :disabled="!canMake()" @click="remove(item)">删除</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
});
const blocks = ref([]);
const form = reactive({ id: null, title: '', body: '' });

function reset() {
  form.id = null;
  form.title = '';
  form.body = '';
}
async function load() {
  blocks.value = await request(`/projects/${props.projectId}/copy-blocks`) || [];
}
function edit(item) {
  form.id = item.id;
  form.title = item.title || '';
  form.body = item.body || '';
}
async function save() {
  const data = { title: form.title, body: form.body, sort_order: blocks.value.length + 1 };
  try {
    if (form.id) {
      await request(`/projects/${props.projectId}/copy-blocks/${form.id}`, { method: 'put', data });
    } else {
      await request(`/projects/${props.projectId}/copy-blocks`, { method: 'post', data });
    }
    ElMessage.success('已保存文案');
    reset();
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function remove(item) {
  try {
    await request(`/projects/${props.projectId}/copy-blocks/${item.id}`, { method: 'delete' });
    if (form.id === item.id) reset();
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

watch(() => props.projectId, () => {
  reset();
  load().catch(err => ElMessage.error(err.message));
});
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>
