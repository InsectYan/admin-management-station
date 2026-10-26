<template>
  <div class="cartoon-review">
    <h3 class="cartoon-module__title">审核</h3>
    <p class="cartoon-module__hint">通过后进入导出，不会发到站外。驳回会回到选定节点。</p>
    <el-form label-position="top" class="cartoon-entry-form">
      <div class="cartoon-entry-grid">
        <el-form-item label="问题"><el-input v-model="issues" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="note" /></el-form-item>
        <el-form-item label="驳回后回到">
          <el-select v-model="node" style="width: 100%">
            <el-option label="脚本" value="script" />
            <el-option label="分镜" value="storyboard" />
            <el-option label="生成" value="generate" />
          </el-select>
        </el-form-item>
      </div>
      <div class="cartoon-entry-actions">
        <el-button type="primary" :disabled="!canMake()" @click="decide('pass')">通过</el-button>
        <el-button :disabled="!canMake()" @click="decide('reject')">驳回</el-button>
      </div>
    </el-form>
    <p v-if="latest">最近一次：{{ latest.decision === 'pass' ? '通过' : '驳回' }} · {{ latest.node }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
});
const issues = ref('');
const note = ref('');
const node = ref('script');
const latest = ref(null);

async function load() {
  const rows = await request(`/projects/${props.projectId}/reviews`);
  latest.value = rows?.[0] || null;
}
async function decide(decision) {
  try {
    await request(`/projects/${props.projectId}/reviews`, {
      method: 'post',
      data: { decision, note: note.value, issues: issues.value, node: node.value },
    });
    ElMessage.success(decision === 'pass' ? '已通过，进入导出' : '已驳回');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(() => {
  load().catch(() => {});
});
</script>
