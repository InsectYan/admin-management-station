<template>
  <el-form label-position="top" class="ops-deploy-form">
    <el-form-item label="环境">
      <el-radio-group v-model="params.env">
        <el-radio-button label="staging">staging</el-radio-button>
        <el-radio-button label="production">production</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <template v-if="projectType === 'frontend' || projectType === 'fullstack'">
      <el-form-item label="构建命令">
        <el-input v-model="params.build_cmd" />
      </el-form-item>
      <el-form-item label="产物目录">
        <el-input v-model="params.out_dir" />
      </el-form-item>
    </template>
    <template v-else-if="projectType === 'backend'">
      <el-form-item label="安装命令">
        <el-input v-model="params.install_cmd" />
      </el-form-item>
      <el-form-item label="启动提示">
        <el-input v-model="params.start_hint" />
      </el-form-item>
    </template>
    <template v-else-if="projectType === 'agent'">
      <el-form-item label="Skill 名">
        <el-input v-model="params.skill_name" placeholder="部署的 Agent 工作区 skill" />
      </el-form-item>
    </template>
    <el-form-item label="通知邮箱（选填）">
      <el-input v-model="params.notify_email" placeholder="本期只落库，不发信" />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  projectType: { type: String, default: 'frontend' },
  modelValue: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue']);

const params = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
</script>
