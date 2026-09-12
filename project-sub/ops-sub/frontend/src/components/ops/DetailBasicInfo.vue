<template>
  <div>
    <el-form :model="form" label-width="96px" class="ops-magic-form">
      <el-form-item label="项目名称">
        <el-input v-if="!readonly" v-model="form.name" maxlength="80" show-word-limit />
        <span v-else>{{ form.name || '—' }}</span>
      </el-form-item>
      <el-form-item label="项目类型">
        <el-select v-if="!readonly" v-model="form.project_type" style="width: 240px">
          <el-option
            v-for="item in PROJECT_TYPE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-else>{{ typeLabel(form.project_type) }}</span>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-if="!readonly" v-model="form.status" style="width: 240px">
          <el-option
            v-for="item in PROJECT_STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-else>{{ statusMeta(form.status).label }}</span>
      </el-form-item>
      <el-form-item label="项目路径">
        <el-input
          v-if="!readonly"
          v-model="form.source_path"
          placeholder="本地绝对路径，Agent 扫描用"
        />
        <span v-else class="ops-path">{{ form.source_path || '未填写' }}</span>
      </el-form-item>
      <el-form-item label="仓库地址">
        <el-input v-if="!readonly" v-model="form.repo_url" placeholder="GitHub / Gitee" />
        <span v-else>{{ form.repo_url || '—' }}</span>
      </el-form-item>
      <el-form-item label="简介">
        <el-input v-if="!readonly" v-model="form.description" type="textarea" :rows="5" />
        <p v-else class="ops-desc">{{ form.description || '暂无简介' }}</p>
      </el-form-item>
      <el-form-item label="创建时间">
        <span class="ops-muted">{{ formatDateTime(form.created_at) }}</span>
      </el-form-item>
      <el-form-item label="更新时间">
        <span class="ops-muted">{{ formatDateTime(form.updated_at) }}</span>
      </el-form-item>
    </el-form>
    <slot />
  </div>
</template>

<script setup>
import {
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  formatDateTime,
  statusMeta,
  typeLabel,
} from '../../utils/opsMeta.js';

defineProps({
  form: { type: Object, required: true },
  readonly: { type: Boolean, default: false },
});
</script>

<style scoped>
.ops-magic-form {
  max-width: 720px;
  padding: 8px 4px 16px;
}

.ops-muted,
.ops-desc,
.ops-path {
  color: var(--ops-color-text-secondary);
}

.ops-desc {
  margin: 0;
  white-space: pre-wrap;
}

.ops-path {
  word-break: break-all;
}
</style>
