<template>
  <PageShell title="流水线">
    <p class="cartoon-module__hint">这里只保存节点和模型参数。运行仍走原来的 Skill、预检和 ComfyUI，不会把生产稿写进故事包。</p>
    <div class="cartoon-module">
      <el-select v-model="contentType" style="width: 180px" @change="load">
        <el-option v-for="item in CONTENT_TYPES" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
    </div>

    <div class="cartoon-module">
      <h3 class="cartoon-module__title">默认节点</h3>
      <div class="cartoon-pipeline-add">
        <el-button v-for="item in catalog" :key="item.node_key" :disabled="!canMake()" @click="addNode(item)">添加{{ item.title }}</el-button>
      </div>
      <el-table :data="nodes">
        <el-table-column prop="title" label="节点" min-width="140" />
        <el-table-column label="来源" min-width="180">
          <template #default="{ row }">{{ sourceLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" :disabled="row.locked || !canMake()" @change="value => toggleNode(row, value)" />
          </template>
        </el-table-column>
        <el-table-column label="" width="90">
          <template #default="{ row }">
            <el-button v-if="row.removable" link type="danger" :disabled="!canMake()" @click="removeNode(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="cartoon-module">
      <h3 class="cartoon-module__title">模型参数</h3>
      <el-table :data="agents">
        <el-table-column prop="label" label="角色" width="120" />
        <el-table-column prop="skill_name" label="Skill" min-width="180">
          <template #default="{ row }">{{ row.skill_name || (row.local ? '本地' : '未接入') }}</template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">{{ row.enabled ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="" width="90">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="!canMake()" @click="openAgent(row)">配置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="agentVisible" :title="agentForm.label || '模型参数'" width="520px">
      <el-form label-position="top" class="cartoon-entry-form">
        <p v-if="agentForm.role === 'writer'" class="cartoon-module__hint">编剧只产出生产稿，不写故事包。</p>
        <div class="cartoon-entry-grid">
          <el-form-item label="输入"><el-input v-model="agentForm.input_text" /></el-form-item>
          <el-form-item label="输出"><el-input v-model="agentForm.output_text" /></el-form-item>
          <el-form-item label="模型档位">
            <el-select v-model="agentForm.model_profile" clearable placeholder="选择档位" style="width: 100%">
              <el-option v-for="item in profiles" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="重试次数"><el-input-number v-model="agentForm.retry_count" :min="0" :max="5" /></el-form-item>
          <el-form-item class="is-wide" label="规则"><el-input v-model="agentForm.rule_text" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="人工确认"><el-switch v-model="agentForm.human_confirm" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="agentForm.enabled" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="agentVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAgent">保存</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { CONTENT_TYPES } from '../lib/contentTypes.js';

const route = useRoute();
const contentType = ref(route.params.contentType || 'ai_comic');
const nodes = ref([]);
const agents = ref([]);
const catalog = ref([]);
const profiles = ref([]);
const agentVisible = ref(false);
const saving = ref(false);
const agentForm = reactive({
  role: '',
  label: '',
  input_text: '',
  output_text: '',
  model_profile: '',
  rule_text: '',
  retry_count: 1,
  human_confirm: false,
  enabled: false,
});

function sourceLabel(row) {
  if (row.skill_name) return row.skill_name;
  if (row.runner === 'comfy') return '预检 + ComfyUI';
  if (row.runner === 'ffmpeg') return '本地剪辑';
  return '本地';
}
function apply(data) {
  nodes.value = data.nodes || [];
  agents.value = data.agents || [];
  catalog.value = data.custom_catalog || [];
  profiles.value = data.model_profiles || [];
}
async function load() {
  apply(await request('/pipelines', { params: { content_type: contentType.value } }));
}
async function addNode(item) {
  try {
    apply(await request('/pipelines/nodes', { method: 'post', data: { content_type: contentType.value, node_key: item.node_key } }));
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function toggleNode(row, enabled) {
  try {
    apply(await request(`/pipelines/nodes/${row.node_key}`, {
      method: 'put',
      data: { content_type: contentType.value, enabled },
    }));
  } catch (err) {
    ElMessage.error(err.message);
    await load().catch(() => {});
  }
}
async function removeNode(row) {
  try {
    apply(await request(`/pipelines/nodes/${row.node_key}`, {
      method: 'delete',
      params: { content_type: contentType.value },
    }));
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function openAgent(row) {
  Object.assign(agentForm, {
    role: row.role,
    label: row.label,
    input_text: row.input_text || '',
    output_text: row.output_text || '',
    model_profile: row.model_profile || '',
    rule_text: row.rule_text || '',
    retry_count: row.retry_count,
    human_confirm: Boolean(row.human_confirm),
    enabled: Boolean(row.enabled),
  });
  agentVisible.value = true;
}
async function saveAgent() {
  saving.value = true;
  try {
    apply(await request(`/pipelines/agents/${agentForm.role}`, {
      method: 'put',
      data: { ...agentForm, content_type: contentType.value },
    }));
    agentVisible.value = false;
    ElMessage.success('已保存参数');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>

<style scoped>
.cartoon-pipeline-add {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
