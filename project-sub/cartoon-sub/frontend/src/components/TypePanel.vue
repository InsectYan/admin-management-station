<template>
  <div class="cartoon-panel">
    <h3 class="cartoon-module__title">{{ commerce ? '电商面板' : '短剧面板' }}</h3>
    <el-form label-position="top">
      <template v-if="commerce">
        <el-form-item label="商品素材"><el-input v-model="form.product_note" /></el-form-item>
        <el-form-item label="卖点"><el-input v-model="form.selling_points" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="对比"><el-input v-model="form.comparison" /></el-form-item>
      </template>
      <template v-else>
        <el-form-item label="冲突"><el-input v-model="form.conflict" /></el-form-item>
        <el-form-item label="反转"><el-input v-model="form.twist" /></el-form-item>
        <el-form-item label="节奏"><el-input v-model="form.rhythm" /></el-form-item>
        <el-form-item label="互动分支"><el-input v-model="form.branches" /></el-form-item>
      </template>
      <el-button type="primary" :disabled="!canMake()" @click="save">保存面板</el-button>
      <span v-if="ready">可以生成</span>
      <span v-else>面板填完后才能生成</span>
    </el-form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
  commerce: { type: Boolean, default: false },
});
const ready = ref(false);
const form = reactive({
  conflict: '',
  twist: '',
  rhythm: '',
  branches: '',
  product_note: '',
  selling_points: '',
  comparison: '',
});
async function load() {
  const data = await request(`/projects/${props.projectId}/panel`);
  ready.value = Boolean(data.ready);
  Object.assign(form, data.panel || {});
}
async function save() {
  try {
    const data = await request(`/projects/${props.projectId}/panel`, { method: 'put', data: { ...form } });
    ready.value = Boolean(data.ready);
    ElMessage.success('已保存面板');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>
