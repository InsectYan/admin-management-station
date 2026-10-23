<template>
  <PageShell v-if="row" :title="row.name">
    <template #extra>
      <el-button link type="primary" @click="router.push('/workflows')">← 返回列表</el-button>
      <el-button type="primary" @click="router.push(`/workflows/${row.id}/edit`)">编辑</el-button>
    </template>
    <el-tabs v-model="tab">
      <el-tab-pane label="信息" name="info">
        <div class="precheck-module">
          <dl class="precheck-workflow-facts">
            <div><dt>名称</dt><dd>{{ row.name }}</dd></div>
            <div><dt>分类</dt><dd>{{ categoryLabel(row.category) }}</dd></div>
            <div><dt>建议显存</dt><dd>{{ row.suggested_vram_gb == null ? '不限制' : `${row.suggested_vram_gb} GB` }}</dd></div>
          </dl>
          <p>节点：{{ (row.required_nodes || []).join('、') || '无' }}</p>
          <p>模型：{{ (row.required_models || []).join('、') || '无' }}</p>
          <DependencyCheck :run="inspect" />
        </div>
      </el-tab-pane>
      <el-tab-pane label="预览" name="preview">
        <div class="precheck-module">
          <p class="precheck-module__hint">填写正向提示词，需要图片的工作流先上传图片。重复生成时只留下最新的一份产物。</p>
          <WorkflowPreview :workflow-id="row.id" :api-json="row.api_json" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '../components/PageShell.vue';
import DependencyCheck from '../components/DependencyCheck.vue';
import WorkflowPreview from '../components/WorkflowPreview.vue';
import { request } from '../services/apiConfig.js';
import { categoryLabel } from '../lib/workflowCategory.js';

const route = useRoute();
const router = useRouter();
const row = ref(null);
const tab = ref('info');

async function inspect() {
  return request(`/workflows/${route.params.id}/dependencies`);
}
onMounted(async () => {
  row.value = await request(`/workflows/${route.params.id}`);
});
</script>

<style scoped>
.precheck-workflow-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0 0 12px; }
.precheck-workflow-facts dt { color: #5c6b62; font-size: 12px; }
.precheck-workflow-facts dd { margin: 4px 0 0; }
.precheck-module__hint { margin: 0 0 12px; color: #5c6b62; }
</style>
