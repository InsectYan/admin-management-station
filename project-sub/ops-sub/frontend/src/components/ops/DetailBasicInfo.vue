<template>
  <el-form :model="form" label-width="96px" class="ops-magic-form">
    <el-form-item label="项目名称">
      <el-input v-model="form.name" maxlength="80" show-word-limit />
    </el-form-item>
    <el-form-item label="项目类型">
      <el-select v-model="form.project_type" style="width: 240px">
        <el-option
          v-for="item in PROJECT_TYPE_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="状态">
      <el-select v-model="form.status" style="width: 240px">
        <el-option
          v-for="item in PROJECT_STATUS_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="仓库地址">
      <el-input v-model="form.repo_url" placeholder="GitHub / Gitee" />
    </el-form-item>
    <el-form-item label="简介">
      <el-input v-model="form.description" type="textarea" :rows="5" />
    </el-form-item>
    <el-form-item label="创建时间">
      <span class="ops-muted">{{ formatDateTime(form.created_at) }}</span>
    </el-form-item>
    <el-form-item label="更新时间">
      <span class="ops-muted">{{ formatDateTime(form.updated_at) }}</span>
    </el-form-item>
  </el-form>
</template>

<script setup>
import {
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  formatDateTime,
} from '../../utils/opsMeta.js';

defineProps({
  form: { type: Object, required: true },
});
</script>

<style scoped>
.ops-magic-form {
  max-width: 720px;
  padding: 8px 4px 24px;
}

.ops-muted {
  color: var(--ops-color-text-secondary);
}
</style>
