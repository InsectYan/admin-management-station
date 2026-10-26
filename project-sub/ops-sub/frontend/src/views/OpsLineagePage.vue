<template>
  <PageShell title="版权溯源">
    <section class="ops-section">
    <p class="ops-lineage-note">按成片编号查出故事包版本、资产编号、模型档位、工作流和操作者。这里不保存成片文件。</p>
    <el-form label-position="top" class="ops-entry-form" @submit.prevent="load">
      <div class="ops-entry-grid">
        <el-form-item label="成片编号"><el-input v-model="outputId" /></el-form-item>
      </div>
      <div class="ops-entry-actions">
        <el-button type="primary" :loading="loading" @click="load">查询</el-button>
      </div>
    </el-form>
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" />
    <dl v-else-if="row" class="ops-lineage-facts">
      <div><dt>成片</dt><dd>{{ row.output_id }}</dd></div>
      <div><dt>视频项目</dt><dd>{{ row.project_id }}</dd></div>
      <div><dt>故事包</dt><dd>{{ row.package_id || '未钉扎' }}</dd></div>
      <div><dt>故事包版本</dt><dd>{{ row.package_version ?? '—' }}</dd></div>
      <div><dt>资产编号</dt><dd>{{ row.asset_ids?.length ? row.asset_ids.join('、') : '没有资产' }}</dd></div>
      <div><dt>模型档位</dt><dd>{{ row.model_profile || '未记录' }}</dd></div>
      <div><dt>工作流</dt><dd>{{ row.workflow_id ?? '未记录' }}</dd></div>
      <div><dt>操作者</dt><dd>{{ row.operator_name || '未记录' }}</dd></div>
    </dl>
    </section>
  </PageShell>
</template>

<script setup>
import { ref } from 'vue';
import PageShell from '../components/PageShell.vue';
import { fetchLineage } from '../services/contentOpsService.js';

const outputId = ref('');
const row = ref(null);
const error = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  error.value = '';
  row.value = null;
  try {
    row.value = await fetchLineage(outputId.value);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.ops-lineage-note {
  margin: 0 0 12px;
  color: #5c6b62;
}
.ops-lineage-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin: 16px 0 0;
}
.ops-lineage-facts dt { color: #5c6b62; font-size: 12px; }
.ops-lineage-facts dd { margin: 4px 0 0; }
</style>
