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
      <strong>TS-05-API</strong>（当前 {{ item?.scheme_primary_id }}），
      不兼容的主验证将自动替换为 TS-05-API 默认验证。
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
        混合 TS 大类默认使用 <strong>TPL-API-CTX</strong>；可切换为
        <strong>TPL-CHAIN</strong> 或其它 TS/模板组合。
      </p>
    </el-form-item>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { setItemConfigTemplate } from '@/services/fitnessService.js';
import {
  API_CTX_TEMPLATE,
  TEMPLATE_DISPLAY_NAMES,
  resolveMixedEffectiveTemplate,
} from './registry.js';

const props = defineProps({
  itemId: { type: String, required: true },
  item: { type: Object, default: null },
  switchMeta: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits([ 'switched' ]);

const loading = ref(false);
const selected = ref(API_CTX_TEMPLATE);

const visible = computed(() => Boolean(props.switchMeta?.can_switch_api_ctx));
const needsSchemeUpgrade = computed(() => Boolean(props.switchMeta?.needs_scheme_upgrade_for_api_ctx));
const effectiveCode = computed(() =>
  resolveMixedEffectiveTemplate(props.item, props.switchMeta),
);
const pairOptions = computed(() => props.switchMeta?.template_alternatives || []);
const hasPairChoice = computed(() =>
  pairOptions.value.includes('TPL-CHAIN') && pairOptions.value.includes(API_CTX_TEMPLATE),
);

function templateLabel(code) {
  return TEMPLATE_DISPLAY_NAMES[code] ? `${code} · ${TEMPLATE_DISPLAY_NAMES[code]}` : code;
}

watch(
  () => effectiveCode.value,
  code => {
    selected.value = code === API_CTX_TEMPLATE ? API_CTX_TEMPLATE : 'TPL-CHAIN';
  },
  { immediate: true },
);

async function applyTemplate(templateCode) {
  if (templateCode === effectiveCode.value) return;
  loading.value = true;
  try {
    if (templateCode === API_CTX_TEMPLATE && needsSchemeUpgrade.value) {
      await ElMessageBox.confirm(
        '将主方案调整为 TS-05-API 并使用 TPL-API-CTX 配置面板，是否继续？',
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
    selected.value = effectiveCode.value === API_CTX_TEMPLATE ? API_CTX_TEMPLATE : 'TPL-CHAIN';
  } finally {
    loading.value = false;
  }
}

function onSelect(code) {
  applyTemplate(code);
}

function switchToApiCtx() {
  applyTemplate(API_CTX_TEMPLATE);
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
