<template>
  <PageShell :title="isEdit ? '编辑项目' : '新建项目'">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 720px">
      <el-form-item label="项目编码" prop="project_code">
        <el-input
          v-model="form.project_code"
          :disabled="isEdit"
          placeholder="如 fitness-agent，创建后不可修改"
        />
      </el-form-item>
      <el-form-item label="项目名称" prop="project_name">
        <el-input v-model="form.project_name" placeholder="项目显示名称" />
      </el-form-item>
      <el-form-item label="所属团队">
        <el-input v-model="form.team" placeholder="如 QA 团队" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" style="width: 100%">
          <el-option label="活跃" value="active" />
          <el-option label="草稿" value="draft" />
          <el-option label="归档" value="archived" />
        </el-select>
      </el-form-item>
      <el-form-item label="项目描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>

      <el-divider content-position="left">代码仓库</el-divider>
      <el-form-item label="仓库地址">
        <div class="repo-list">
          <div v-for="(url, idx) in form.repo_urls" :key="idx" class="repo-row">
            <el-input v-model="form.repo_urls[idx]" placeholder="https://github.com/org/repo" />
            <el-button link type="danger" @click="form.repo_urls.splice(idx, 1)">移除</el-button>
          </div>
          <el-button @click="form.repo_urls.push('')">添加仓库</el-button>
        </div>
      </el-form-item>

      <el-divider content-position="left">CI/CD 配置</el-divider>
      <el-form-item label="提供商">
        <el-input v-model="form.cicd_config.provider" placeholder="github-actions / jenkins / gitlab-ci" />
      </el-form-item>
      <el-form-item label="流水线文件">
        <el-input v-model="form.cicd_config.pipeline" placeholder="ci-test.yml" />
      </el-form-item>

      <el-divider content-position="left">成员权限</el-divider>
      <el-form-item label="成员列表">
        <div class="member-list">
          <div v-for="(m, idx) in form.member_roles" :key="idx" class="member-row">
            <el-input v-model="m.user" placeholder="用户名" style="width: 160px" />
            <el-select v-model="m.role" style="width: 120px">
              <el-option label="所有者" value="owner" />
              <el-option label="编辑者" value="editor" />
              <el-option label="查看者" value="viewer" />
            </el-select>
            <el-button link type="danger" @click="form.member_roles.splice(idx, 1)">移除</el-button>
          </div>
          <el-button @click="form.member_roles.push({ user: '', role: 'viewer' })">添加成员</el-button>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
        <el-button @click="router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import { createProject, fetchProject, updateProject } from '@/services/projectService.js';

const route = useRoute();
const router = useRouter();
const formRef = ref(null);
const saving = ref(false);
const isEdit = computed(() => !!route.params.projectCode && route.name === 'project-edit');

const form = reactive({
  project_code: '',
  project_name: '',
  team: '',
  status: 'active',
  description: '',
  repo_urls: [],
  cicd_config: { provider: '', pipeline: '' },
  member_roles: [],
});

const rules = {
  project_code: [
    { required: true, message: '请输入项目编码', trigger: 'blur' },
    { pattern: /^[a-z0-9][a-z0-9-_]*$/, message: '仅小写字母、数字、连字符', trigger: 'blur' },
  ],
  project_name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
};

async function loadProject() {
  if (!isEdit.value) return;
  const data = await fetchProject(route.params.projectCode);
  Object.assign(form, {
    project_code: data.project_code,
    project_name: data.project_name,
    team: data.team || '',
    status: data.status || 'active',
    description: data.description || '',
    repo_urls: [ ...(data.repo_urls || []) ],
    cicd_config: { provider: '', pipeline: '', ...(data.cicd_config || {}) },
    member_roles: [ ...(data.member_roles || []) ],
  });
}

async function submit() {
  await formRef.value.validate();
  saving.value = true;
  try {
    const payload = {
      ...form,
      repo_urls: form.repo_urls.filter(Boolean),
      member_roles: form.member_roles.filter(m => m.user),
    };
    if (isEdit.value) {
      await updateProject(route.params.projectCode, payload);
      ElMessage.success('已更新');
      router.push(`/projects/${encodeURIComponent(route.params.projectCode)}`);
    } else {
      const created = await createProject(payload);
      ElMessage.success('项目已创建');
      router.push(`/projects/${encodeURIComponent(created.project_code)}`);
    }
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadProject);
</script>

<style scoped>
.repo-list, .member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.repo-row, .member-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
