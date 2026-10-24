<template>
  <div class="cartoon-panel">
    <h3 class="cartoon-module__title">{{ title }}</h3>
    <el-form label-position="top">
      <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
        <el-input v-model="form[field.key]" type="textarea" :rows="2" />
      </el-form-item>
      <el-button type="primary" :disabled="!canMake() || !fields.length" @click="save">保存面板</el-button>
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
});
const title = ref('类型面板');
const ready = ref(false);
const fields = ref([]);
const form = reactive({});

async function load() {
  const data = await request(`/projects/${props.projectId}/panel`);
  ready.value = Boolean(data.ready);
  title.value = data.label ? `${data.label}面板` : '类型面板';
  fields.value = data.fields || [];
  for (const field of fields.value) form[field.key] = field.value || '';
}

async function save() {
  try {
    const data = await request(`/projects/${props.projectId}/panel`, { method: 'put', data: { ...form } });
    ready.value = Boolean(data.ready);
    fields.value = data.fields || fields.value;
    ElMessage.success('已保存面板');
  } catch (err) {
    ElMessage.error(err.message);
  }
}

onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>
