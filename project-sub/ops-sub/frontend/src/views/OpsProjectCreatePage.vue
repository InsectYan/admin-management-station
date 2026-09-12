<template>
  <PageShell title="新建项目">
    <template #extra>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>首页</el-breadcrumb-item>
        <el-breadcrumb-item>
          <a href="#" @click.prevent="goList">项目信息</a>
        </el-breadcrumb-item>
        <el-breadcrumb-item>新建</el-breadcrumb-item>
      </el-breadcrumb>
      <el-button @click="goList">返回列表</el-button>
      <el-button type="primary" :loading="saving" @click="saveDraft">仅保存基础信息</el-button>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="96px"
      class="ops-magic-form"
    >
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" maxlength="80" show-word-limit placeholder="例如：小说创作平台前端" />
      </el-form-item>
      <el-form-item label="项目类型" prop="type">
        <el-select v-model="form.type" style="width: 240px">
          <el-option
            v-for="item in PROJECT_TYPE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="项目路径" prop="source_path">
        <el-input
          v-model="form.source_path"
          placeholder="本地绝对路径，供 Agent 扫描。例如 E:/.../novel-sub/frontend"
        />
      </el-form-item>
      <el-form-item label="仓库地址">
        <el-input v-model="form.repo_url" placeholder="可选，GitHub / Gitee" />
      </el-form-item>
      <el-form-item label="简介">
        <el-input v-model="form.description" type="textarea" :rows="4" placeholder="项目职责与范围" />
      </el-form-item>
    </el-form>

    <OpsGeneratePanel
      :source-path="form.source_path"
      :basic="form"
      @generated="onGenerated"
    />

    <div v-if="generated" class="ops-create-import">
      <el-button type="success" :loading="importing" @click="importGenerated">
        导入项目库
      </el-button>
      <span class="ops-create-import__hint">将生成的目录、路由、流程图写入项目库并进入编辑页。</span>
    </div>
  </PageShell>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import OpsGeneratePanel from '../components/ops/OpsGeneratePanel.vue';
import { createProject, importProject } from '../services/opsService.js';
import { PROJECT_TYPE_OPTIONS, emptyOverviewFlow } from '../utils/opsMeta.js';

const router = useRouter();
const formRef = ref(null);
const saving = ref(false);
const importing = ref(false);
const generated = ref(null);
const form = reactive({
  name: '',
  type: 'frontend',
  source_path: '',
  repo_url: '',
  description: '',
});
const rules = {
  name: [{ required: true, message: '请填写项目名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

function goList() {
  router.push({ name: 'ops-list' });
}

function onGenerated(data) {
  generated.value = data;
}

async function saveDraft() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const created = await createProject({
      ...form,
      status: 'draft',
      directory_tree: [],
      routes: [],
      flows: [ emptyOverviewFlow() ],
    });
    ElMessage.success('已保存基础信息');
    router.push({ name: 'ops-edit', params: { id: String(created.id) } });
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function importGenerated() {
  if (!generated.value?.document) return;
  await formRef.value?.validate();
  importing.value = true;
  try {
    const doc = {
      ...generated.value.document,
      name: form.name || generated.value.document.name,
      type: form.type || generated.value.document.type,
      description: form.description || generated.value.document.description,
      repo_url: form.repo_url || generated.value.document.repo_url,
      source_path: form.source_path || generated.value.document.source_path,
      status: 'draft',
    };
    const created = await importProject(doc);
    ElMessage.success(`已导入「${created.name}」`);
    router.push({ name: 'ops-edit', params: { id: String(created.id) } });
  } catch (err) {
    ElMessage.error(err.message || '导入失败');
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.ops-magic-form {
  max-width: 720px;
  padding: 8px 4px 8px;
}

.ops-create-import {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 720px;
  margin: 16px 0 24px;
}

.ops-create-import__hint {
  font-size: 13px;
  color: var(--ops-color-text-secondary);
}
</style>
