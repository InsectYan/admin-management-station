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
            <div v-if="defaultSteps != null"><dt>默认步数</dt><dd>{{ defaultSteps }}</dd></div>
          </dl>
          <p v-if="refmod" class="precheck-module__hint">这条工作流可以导入本页检测用的人物包和场景包。在预览里按顺序选择，提示词用 &lt;Picture 1&gt; 起指代。正式包按项目放在 AI 视频里。</p>
          <p>节点：{{ (row.required_nodes || []).join('、') || '无' }}</p>
          <p>模型：{{ (row.required_models || []).join('、') || '无' }}</p>
          <DependencyCheck :run="inspect" />
        </div>
      </el-tab-pane>
      <el-tab-pane label="预览" name="preview">
        <div class="precheck-module">
          <p class="precheck-module__hint">填写正向提示词，需要图片的工作流先上传图片。每次生成都会留下一条产物，可以删除。</p>
          <WorkflowPreview :workflow-id="row.id" :api-json="row.api_json" :refmod="refmod" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
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
const refmod = computed(() => String(row.value?.name || '').includes('[RefMod]'));
const defaultSteps = computed(() => {
  const graph = row.value?.api_json;
  if (!graph || typeof graph !== 'object') return null;
  const node = Object.values(graph).find(item => item?.inputs && typeof item.inputs.steps === 'number');
  return node ? node.inputs.steps : null;
});

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
