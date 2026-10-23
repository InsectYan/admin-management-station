<template>
  <PageShell title="规则">
    <p class="cartoon-module__hint">规则按内容类型保存。已经开始的批次仍用创建时的快照，之后的修改只影响新批次。</p>
    <div class="cartoon-module">
      <el-select v-model="contentType" style="width: 160px" @change="load">
        <el-option label="漫剧" value="ai_comic" />
        <el-option label="短剧" value="ai_short" />
        <el-option label="科普" value="ai_science" />
        <el-option label="电商" value="ai_commerce" />
      </el-select>
    </div>
    <div class="cartoon-module">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.kind" style="width: 100%">
            <el-option label="风格" value="style" />
            <el-option label="品牌" value="brand" />
            <el-option label="平台规格" value="platform" />
            <el-option label="敏感词" value="banned" />
            <el-option label="内容分级" value="rating" />
            <el-option label="成本上限" value="cost" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.kind === 'cost'" label="上限">
          <el-input-number v-model="form.cost_cap" :min="1" />
        </el-form-item>
        <el-form-item v-else-if="form.kind === 'rating'" label="分级">
          <el-select v-model="form.body" style="width: 100%">
            <el-option label="全年龄" value="全年龄" />
            <el-option label="青少年" value="青少年" />
            <el-option label="成人" value="成人" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="内容">
          <el-input v-model="form.body" type="textarea" :rows="3" placeholder="敏感词一行一个" />
        </el-form-item>
        <el-button type="primary" :disabled="!canMake()" @click="create">添加规则</el-button>
      </el-form>
      <el-table :data="rows" class="cartoon-rule-table">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="kind" label="类型" width="120" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" :disabled="!canMake()" @change="value => toggle(row, value)" />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const contentType = ref('ai_comic');
const rows = ref([]);
const form = reactive({ name: '', kind: 'style', body: '', cost_cap: 10 });

async function load() {
  rows.value = await request('/rules', { params: { content_type: contentType.value } }) || [];
}
async function create() {
  try {
    await request('/rules', {
      method: 'post',
      data: { ...form, content_type: contentType.value, enabled: true },
    });
    form.name = '';
    form.body = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function toggle(row, enabled) {
  try {
    await request(`/rules/${row.id}`, { method: 'put', data: { ...row, enabled } });
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>

<style scoped>
.cartoon-rule-table { margin-top: 16px; }
</style>
