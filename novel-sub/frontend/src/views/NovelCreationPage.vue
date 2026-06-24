<template>
  <PageShell title="新建小说">
    <el-steps :active="current" finish-status="success" style="margin-bottom: 24px">
      <el-step v-for="step in steps" :key="step.title" :title="step.title" />
    </el-steps>

    <el-form ref="formRef" :model="form" label-position="top">
      <template v-if="current === 0">
        <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题' }]">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="作者" prop="author_name" :rules="[{ required: true, message: '请输入作者' }]">
          <el-input v-model="form.author_name" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option value="draft" label="草稿" />
            <el-option value="published" label="已发布" />
          </el-select>
        </el-form-item>
      </template>
      <template v-else-if="current === 1">
        <el-form-item label="大纲">
          <el-input v-model="form.plot.outline" type="textarea" :rows="8" />
        </el-form-item>
      </template>
      <template v-else-if="current === 2">
        <el-form-item label="正文">
          <el-input v-model="form.draft.content" type="textarea" :rows="12" />
        </el-form-item>
      </template>
      <template v-else-if="current === 3">
        <el-form-item label="审稿意见">
          <el-input v-model="form.draft.review" type="textarea" :rows="8" />
        </el-form-item>
      </template>
    </el-form>

    <div style="margin-top: 16px; display: flex; gap: 8px">
      <el-button :disabled="current === 0" @click="current -= 1">上一步</el-button>
      <el-button type="primary" @click="handleNext">
        {{ current === steps.length - 1 ? '完成' : '下一步' }}
      </el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { createNovel } from '../services/novelService.js';

const DRAFT_KEY = 'novel:create:draft';

function saveDraft(data) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
}

const router = useRouter();
const current = ref(0);
const formRef = ref(null);
const steps = [
  { title: '基本信息' },
  { title: '大纲构建' },
  { title: '正文创作' },
  { title: '审稿润色' },
];

const draft = loadDraft();
const form = reactive({
  title: draft.title || '',
  author_name: draft.author_name || '',
  status: draft.status || 'draft',
  plot: { outline: draft.plot?.outline || '' },
  draft: {
    content: draft.draft?.content || '',
    review: draft.draft?.review || '',
  },
});

async function handleNext() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saveDraft({ ...loadDraft(), ...form });
  if (current.value < steps.length - 1) {
    current.value += 1;
    return;
  }

  try {
    const payload = { ...loadDraft(), ...form };
    await createNovel(payload);
    sessionStorage.removeItem(DRAFT_KEY);
    ElMessage.success('小说创建成功');
    router.push({ name: 'novel-list' });
  } catch (e) {
    ElMessage.error(e.message || '创建失败');
  }
}
</script>
