<template>
  <PageShell title="合规">
    <section class="ops-section">
    <p class="ops-compliance-hint">敏感词命中只返回规则编号。当前版本 {{ version }}。修改规则会增加版本，已经拦住的任务仍按当时的编号解释。</p>
    <el-form label-position="top" class="ops-entry-form ops-compliance-form" @submit.prevent="create">
      <div class="ops-entry-grid">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.kind" style="width: 100%">
            <el-option label="敏感词" value="banned" />
            <el-option label="内容分级" value="rating" />
            <el-option label="AI 标识" value="ai_mark" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.kind === 'rating'" label="分级">
          <el-select v-model="form.body" style="width: 100%">
            <el-option label="全年龄" value="全年龄" />
            <el-option label="青少年" value="青少年" />
            <el-option label="成人" value="成人" />
          </el-select>
        </el-form-item>
        <el-form-item v-else-if="form.kind === 'ai_mark'" label="开关">
          <el-select v-model="form.body" style="width: 100%">
            <el-option label="开" value="开" />
            <el-option label="关" value="关" />
          </el-select>
        </el-form-item>
        <el-form-item v-else class="is-wide" label="词条">
          <el-input v-model="form.body" type="textarea" :rows="3" placeholder="一行一个" />
        </el-form-item>
      </div>
      <div class="ops-entry-actions">
        <el-button type="primary" @click="create">添加</el-button>
      </div>
    </el-form>
    <el-table :data="rules">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="kind" label="类型" width="120" />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="value => toggle(row, value)" />
        </template>
      </el-table-column>
    </el-table>
    </section>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { createCompliance, fetchCompliance, updateCompliance } from '../services/contentOpsService.js';

const version = ref(1);
const rules = ref([]);
const form = reactive({ name: '', kind: 'banned', body: '' });

async function load() {
  const data = await fetchCompliance();
  version.value = data.version;
  rules.value = data.rules || [];
}
async function create() {
  try {
    await createCompliance({ ...form, enabled: true });
    form.name = '';
    form.body = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function toggle(row, enabled) {
  try {
    await updateCompliance(row.id, { ...row, enabled });
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
.ops-compliance-hint { margin-bottom: 12px; color: #5c6b63; }
.ops-compliance-form { max-width: 520px; margin-bottom: 16px; }
</style>
