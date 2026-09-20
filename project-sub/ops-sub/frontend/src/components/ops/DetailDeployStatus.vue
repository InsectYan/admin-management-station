<template>
  <div class="ops-deploy-status">
    <div class="ops-deploy-status__head">
      <h3 class="ops-deploy-status__title">部署状态</h3>
      <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
    </div>
    <p class="ops-deploy-status__hint">
      独立于部署任务：查询线上 AgentRun 运行时状态，并可在此切换默认模型（会短暂重启，约数十秒）。
    </p>

    <el-alert
      v-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
      class="ops-deploy-status__alert"
    />

    <template v-else-if="status">
      <el-alert
        v-if="!status.agentrun"
        type="info"
        :title="status.message || '当前项目不是 AgentRun 产品'"
        show-icon
        :closable="false"
        class="ops-deploy-status__alert"
      />

      <template v-else>
        <el-descriptions :column="2" border size="small" class="ops-deploy-status__desc">
          <el-descriptions-item label="运行时状态">
            <el-tag :type="statusTagType" size="small" effect="light">{{ status.status || '—' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="运行时语言">
            {{ status.code_language || binding.code_language || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="Runtime ID">
            <span class="ops-mono">{{ binding.agent_runtime_id || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="Agent 名称">
            {{ binding.agent_name || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="地域">
            {{ status.region || binding.region || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="Workspace">
            {{ binding.workspace_id || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="当前默认模型" :span="2">
            {{ currentLabel }}
          </el-descriptions-item>
          <el-descriptions-item label="Endpoint" :span="2">
            <span class="ops-mono">{{ binding.endpoint_url || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="同步时间" :span="2">
            {{ formatDateTime(binding.synced_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="ops-deploy-status__keys">
          <span
            v-for="item in keyChips"
            :key="item.key"
            class="ops-deploy-status__chip"
            :class="{ ok: item.ok }"
          >
            {{ item.label }}：{{ item.ok ? '已配置' : '未配置' }}
          </span>
        </div>

        <div class="ops-deploy-status__switch">
          <label class="ops-deploy-status__label">切换默认模型</label>
          <div class="ops-deploy-status__row">
            <el-select
              v-model="selectedProfile"
              filterable
              placeholder="选择模型"
              style="width: 320px"
              :disabled="switching"
            >
              <el-option
                v-for="item in profiles"
                :key="item.id"
                :label="optionLabel(item)"
                :value="item.id"
                :disabled="!item.available"
              />
            </el-select>
            <el-button
              type="primary"
              :loading="switching"
              :disabled="!canSwitch"
              @click="onSwitch"
            >
              切换并等待就绪
            </el-button>
          </div>
          <p class="ops-deploy-status__hint">
            无对应 API Key 的模型不可选；切换成功后会校验运行时 READY，期间服务可能短暂中断。
          </p>
        </div>
      </template>
    </template>

    <el-skeleton v-else-if="loading" :rows="4" animated />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchProjectRuntime, switchProjectLlm } from '../../services/opsDeployService.js';
import { formatDateTime } from '../../utils/opsMeta.js';

const props = defineProps({
  projectId: { type: [ Number, String ], required: true },
});

const loading = ref(false);
const switching = ref(false);
const error = ref('');
const status = ref(null);
const selectedProfile = ref('');

const binding = computed(() => status.value?.binding || {});
const profiles = computed(() => status.value?.profiles || []);

const currentLabel = computed(() => {
  const id = status.value?.current_llm_profile || '';
  const hit = profiles.value.find((item) => item.id === id);
  if (hit) return hit.label;
  const model = status.value?.current_llm_model || '';
  return id ? `${id}${model ? `（${model}）` : ''}` : '—';
});

const statusTagType = computed(() => {
  const st = String(status.value?.status || '').toUpperCase();
  if (st === 'READY') return 'success';
  if (st.includes('FAIL')) return 'danger';
  if (st === 'UPDATING' || st === 'CREATING') return 'warning';
  return 'info';
});

const keyChips = computed(() => {
  const keys = status.value?.keys_present || {};
  return [
    { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek', ok: Boolean(keys.DEEPSEEK_API_KEY) },
    { key: 'DASHSCOPE_API_KEY', label: '通义千问', ok: Boolean(keys.DASHSCOPE_API_KEY) },
    { key: 'ZHIPU_API_KEY', label: '智谱', ok: Boolean(keys.ZHIPU_API_KEY) },
    { key: 'OPENAI_API_KEY', label: 'OpenAI', ok: Boolean(keys.OPENAI_API_KEY) },
  ];
});

const canSwitch = computed(() => {
  if (!selectedProfile.value || switching.value) return false;
  if (selectedProfile.value === status.value?.current_llm_profile) return false;
  const hit = profiles.value.find((item) => item.id === selectedProfile.value);
  return Boolean(hit?.available);
});

function optionLabel(item) {
  return `${item.label}${item.available ? '' : '（缺 API Key）'}`;
}

async function refresh() {
  if (!props.projectId) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchProjectRuntime(props.projectId);
    status.value = data;
    selectedProfile.value = data?.current_llm_profile || '';
  } catch (err) {
    error.value = err.message || '查询部署状态失败';
    status.value = null;
  } finally {
    loading.value = false;
  }
}

async function onSwitch() {
  if (!canSwitch.value) return;
  const hit = profiles.value.find((item) => item.id === selectedProfile.value);
  try {
    await ElMessageBox.confirm(
      `将默认模型切换为「${hit?.label || selectedProfile.value}」。运行时会重启，期间约有数十秒不可用，确认继续？`,
      '切换默认模型',
      { type: 'warning', confirmButtonText: '确认切换', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }

  switching.value = true;
  try {
    const result = await switchProjectLlm(props.projectId, selectedProfile.value);
    if (result?.unchanged) {
      ElMessage.info(result.message || '无需切换');
    } else {
      ElMessage.success(result?.message || '切换成功');
    }
    await refresh();
  } catch (err) {
    ElMessage.error(err.message || '切换失败');
  } finally {
    switching.value = false;
  }
}

watch(() => props.projectId, () => {
  refresh();
});

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.ops-deploy-status {
  max-width: 880px;
  padding: 8px 4px 24px;
}

.ops-deploy-status__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.ops-deploy-status__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-color-text, #1f2d26);
}

.ops-deploy-status__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--ops-color-text-secondary, #5c6b62);
  line-height: 1.5;
}

.ops-deploy-status__alert {
  margin-bottom: 12px;
}

.ops-deploy-status__desc {
  margin-bottom: 12px;
}

.ops-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.ops-deploy-status__keys {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.ops-deploy-status__chip {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(92, 107, 98, 0.08);
  color: var(--ops-color-text-secondary, #5c6b62);
}

.ops-deploy-status__chip.ok {
  background: rgba(47, 138, 91, 0.12);
  color: var(--ops-color-primary, #2f8a5b);
}

.ops-deploy-status__switch {
  padding-top: 4px;
}

.ops-deploy-status__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ops-color-text, #1f2d26);
}

.ops-deploy-status__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
</style>
