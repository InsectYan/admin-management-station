<template>
  <PageShell :title="novel?.title || '小说详情'">
    <template #extra>
      <router-link :to="{ name: 'novel-list' }">返回列表</router-link>
    </template>

    <div v-if="!novel" v-loading="true" style="min-height: 120px" />

    <template v-else>
      <el-descriptions :column="2" border size="small" style="margin-bottom: 24px">
        <el-descriptions-item label="ID">{{ novel.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ novel.status }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ novel.created_at }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ novel.updated_at }}</el-descriptions-item>
      </el-descriptions>

      <el-form ref="formRef" :model="form" label-position="top" @submit.prevent="handleSave">
        <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题' }]">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="作者" prop="author_name">
          <el-input v-model="form.author_name" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option value="draft" label="草稿" />
            <el-option value="published" label="已发布" />
            <el-option value="archived" label="归档" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">保存</el-button>
        </el-form-item>
      </el-form>
    </template>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchNovel, updateNovel } from '../services/novelService.js';

const route = useRoute();
const novel = ref(null);
const formRef = ref(null);
const form = reactive({
  title: '',
  author_name: '',
  status: '',
});

async function loadNovel() {
  try {
    const data = await fetchNovel(route.params.id);
    novel.value = data;
    Object.assign(form, {
      title: data.title,
      author_name: data.author_name,
      status: data.status,
    });
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  try {
    await updateNovel(route.params.id, { ...form });
    ElMessage.success('保存成功');
    loadNovel();
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  }
}

watch(() => route.params.id, loadNovel);
onMounted(loadNovel);
</script>
