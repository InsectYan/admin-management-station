<template>
  <div v-if="visible" class="mixed-ts-switcher">
    <el-alert
      v-if="needsSchemeUpgrade"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
    >
      切换为「前置链路+接口模板」将把主方案调整为
      <strong>TS-05-CHAIN</strong>（当前 {{ item?.scheme_primary_id }}），
      不兼容的主验证将自动替换为 TS-05 默认验证。
    </el-alert>

    <el-form-item label="配置模板" label-width="120px">
      <el-radio-group
        v-if="hasPairChoice"
        v-model="selected"
        :disabled="readonly || loading"
        @change="onSelect"
      >
        <el-radio-button
          v-for="code in pairOptions"
          :key="code"
          :value="code"
        >
          {{ templateLabel(code) }}
        </el-radio-button>
      </el-radio-group>

      <div v-else class="upgrade-row">
        <el-tag type="info">{{ templateLabel(effectiveCode) }}</el-tag>
        <el-button
          type="primary"
          plain
          size="small"
          :loading="loading"
          :disabled="readonly || effectiveCode === 'TPL-API-CTX'"
          @click="switchToApiCtx"
        >
          切换为 TPL-API-CTX
        </el-button>
      </div>

      <p class="hint">
        混合 TS 大类（教练/会员/管理/横切）可在用例级选择
        <strong>TPL-CHAIN</strong> 或 <strong>TPL-API-CTX</strong>。
      </p>
    </el-form-item>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { setItemConfigTemplate } from '@/services/fitnessService.js';
import { TEMPLATE_DISPLAY_NAMES } from './registry.js';

const props = defineProps({
  itemId: { type: String, required: true },
  item: { type: Object, default: null },
  switchMeta: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits([ 'switched' ]);

const loading = ref(false);
const selected = ref('TPL-CHAIN');

const visible = computed(() => Boolean(props.switchMeta?.can_switch_api_ctx));
const needsSchemeUpgrade = computed(() => Boolean(props.switchMeta?.needs_scheme_upgrade_for_api_ctx));
const effectiveCode = computed(() =>
  props.switchMeta?.effective_template_code || props.item?.template_code || 'TPL-CHAIN',
);
const pairOptions = computed(() => props.switchMeta?.template_alternatives || []);
const hasPairChoice = computed(() =>
  pairOptions.value.includes('TPL-CHAIN') && pairOptions.value.includes('TPL-API-CTX'),
);

function templateLabel(code) {
  return TEMPLATE_DISPLAY_NAMES[code] ? `${code} · ${TEMPLATE_DISPLAY_NAMES[code]}` : code;
}

watch(
  () => effectiveCode.value,
  code => {
    selected.value = code === 'TPL-API-CTX' ? 'TPL-API-CTX' : 'TPL-CHAIN';
  },
  { immediate: true },
);

async function applyTemplate(templateCode) {
  if (templateCode === effectiveCode.value) return;
  loading.value = true;
  try {
    if (templateCode === 'TPL-API-CTX' && needsSchemeUpgrade.value) {
      await ElMessageBox.confirm(
        '将主方案调整为 TS-05-CHAIN 并使用 TPL-API-CTX 配置面板，是否继续？',
        '切换配置模板',
        { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' },
      );
    }
    const data = await setItemConfigTemplate(props.itemId, {
      template_code: templateCode,
      upgrade_scheme: true,
    });
    ElMessage.success('配置模板已切换');
    emit('switched', data);
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.message || e.message || '切换失败');
    }
    selected.value = effectiveCode.value === 'TPL-API-CTX' ? 'TPL-API-CTX' : 'TPL-CHAIN';
  } finally {
    loading.value = false;
  }
}

function onSelect(code) {
  applyTemplate(code);
}

function switchToApiCtx() {
  applyTemplate('TPL-API-CTX');
}
</script>

<style scoped>
.hint {
  margin: 8px 0 0;
  color: #909399;
  font-size: 12px;
}
.upgrade-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
