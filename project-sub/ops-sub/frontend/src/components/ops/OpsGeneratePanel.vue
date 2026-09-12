<template>
  <el-card class="ops-generate" shadow="never">
    <template #header>
      <div class="ops-generate__head">
        <span>生成配置文件</span>
        <el-tag size="small" type="info">ops-project-skill</el-tag>
      </div>
    </template>
    <p class="ops-generate__hint">
      Agent Skill 位置：<code>agent-management-master/plugins/ops-project-skill/</code>
      。按基础信息里的项目路径扫描目录与路由，生成总览 + 各页面分流程，再写入项目库。
    </p>
    <el-form label-width="96px" class="ops-magic-form">
      <el-form-item label="提示词">
        <el-input
          v-model="hint"
          type="textarea"
          :rows="3"
          :disabled="readonly"
          placeholder="可选。例如：只梳理 views 下的页面；总览里突出登录与列表关系"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="readonly || !sourcePath"
          @click="runGenerate"
        >
          {{ applyAfter ? '重新生成并写入' : '生成配置文件' }}
        </el-button>
        <span v-if="!sourcePath" class="ops-generate__warn">请先填写项目路径</span>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="result"
      :type="result.source === 'llm' ? 'success' : 'warning'"
      :closable="false"
      :title="result.summary || '已生成'"
    >
      来源 {{ result.source || 'unknown' }} ·
      目录 {{ countTreeNodes(result.document?.directory_tree) }} ·
      路由 {{ countRoutes(result.document?.routes) }} ·
      流程 {{ result.document?.flows?.length || 0 }}
    </el-alert>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { generateAndApplyProject, generateProjectConfig } from '../../services/opsService.js';
import { withLlmSession } from '../../utils/llmProfileSession.js';
import { countRoutes, countTreeNodes } from '../../utils/opsMeta.js';

const props = defineProps({
  sourcePath: { type: String, default: '' },
  basic: { type: Object, default: () => ({}) },
  projectId: { type: [ Number, String ], default: '' },
  applyAfter: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits([ 'generated', 'applied' ]);

const hint = ref('');
const loading = ref(false);
const result = ref(null);

async function runGenerate() {
  loading.value = true;
  try {
    const payload = withLlmSession({
      source_path: props.sourcePath,
      name: props.basic.name,
      type: props.basic.project_type || props.basic.type,
      description: props.basic.description,
      repo_url: props.basic.repo_url,
      status: props.basic.status,
      hint: hint.value,
    });
    const data = props.applyAfter && props.projectId
      ? await generateAndApplyProject(props.projectId, payload)
      : await generateProjectConfig(payload);
    result.value = data;
    emit('generated', data);
    if (data.project) emit('applied', data.project);
    ElMessage.success(props.applyAfter ? '已重新生成并写入项目库' : '已生成配置，可导入项目库');
  } catch (err) {
    ElMessage.error(err.message || '生成失败，请确认 Agent 平台已启动且路径可访问');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.ops-generate {
  max-width: 720px;
  margin-top: 8px;
  border: var(--ops-border-subtle);
  background: var(--ops-color-surface);
}

.ops-generate__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ops-generate__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--ops-color-text-secondary);
  line-height: 1.6;
}

.ops-generate__hint code {
  font-size: 12px;
  color: var(--ops-color-primary);
}

.ops-generate__warn {
  margin-left: 8px;
  font-size: 13px;
  color: var(--ops-color-text-muted);
}
</style>
