<template>
  <el-dialog
    v-model="visible"
    title="新建项目"
    width="520px"
    destroy-on-close
    @closed="reset"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px" class="ops-magic-form">
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" maxlength="80" show-word-limit placeholder="例如：小说创作平台前端" />
      </el-form-item>
      <el-form-item label="项目类型" prop="type">
        <el-select v-model="form.type" style="width: 100%">
          <el-option
            v-for="item in PROJECT_TYPE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="仓库地址">
        <el-input v-model="form.repo_url" placeholder="可选，GitHub / Gitee 地址" />
      </el-form-item>
      <el-form-item label="简介">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="项目职责与范围" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">创建并进入详情</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { PROJECT_TYPE_OPTIONS, emptyFlow } from '../../utils/opsMeta.js';
import { createProject } from '../../services/opsService.js';

const emit = defineEmits(['created']);

const visible = ref(false);
const saving = ref(false);
const formRef = ref(null);
const form = reactive({
  name: '',
  type: 'frontend',
  repo_url: '',
  description: '',
});
const rules = {
  name: [{ required: true, message: '请填写项目名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

function open() {
  visible.value = true;
}

function reset() {
  form.name = '';
  form.type = 'frontend';
  form.repo_url = '';
  form.description = '';
}

async function submit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const created = await createProject({
      ...form,
      status: 'draft',
      directory_tree: [],
      routes: [],
      flows: [emptyFlow()],
    });
    ElMessage.success('已创建项目');
    visible.value = false;
    emit('created', created);
  } catch (err) {
    ElMessage.error(err.message || '创建失败');
  } finally {
    saving.value = false;
  }
}

defineExpose({ open });
</script>
