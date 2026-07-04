<template>
  <div v-loading="loading">
    <el-alert v-if="templateMeta" type="info" :closable="false" style="margin-bottom:12px">
      模板 <strong>{{ templateMeta.template_code }}</strong> · {{ templateMeta.name }}
      <span v-if="activeSchemeId"> · TS: {{ activeSchemeId }}</span>
      <el-tag v-if="configSource" size="small" style="margin-left:8px">{{ configSource === 'agent' ? 'Agent生成' : '手动填写' }}</el-tag>
    </el-alert>

    <el-radio-group
      v-if="editable && hasSecondaryScheme"
      v-model="schemeRole"
      style="margin-bottom:12px"
      @change="onSchemeRoleChange"
    >
      <el-radio-button value="primary">主方案配置</el-radio-button>
      <el-radio-button value="secondary">辅方案配置</el-radio-button>
    </el-radio-group>

    <el-tabs v-if="editable && supportsAgent && schemeRole === 'primary'" v-model="editMode" style="margin-bottom:12px">
      <el-tab-pane label="手动填写" name="manual" />
      <el-tab-pane label="Agent 自动生成" name="agent" />
    </el-tabs>

    <div v-if="editMode === 'agent' && editable && supportsAgent && schemeRole === 'primary'" class="agent-panel">
      <p class="hint">将根据用例元数据调用 <code>{{ templateMeta?.agent_skill || 'fitness-config-skill' }}</code> 生成配置草稿。</p>
      <el-button type="primary" :loading="generating" @click="runGenerate(false)">生成预览</el-button>
      <el-button type="success" :loading="generating" @click="runGenerate(true)">生成并保存</el-button>
    </div>

    <component
      :is="panelComponent"
      v-if="item"
      :item="item"
      v-model="localConfig"
      v-model:threshold="localThreshold"
      :readonly="!editable || editMode === 'agent'"
    />

    <div v-if="editable && editMode === 'manual'" style="margin-top:16px">
      <el-button type="primary" :loading="saving" @click="save">
        保存{{ schemeRole === 'secondary' ? '辅方案' : '主方案' }}配置
      </el-button>
    </div>
    <p v-if="!editable" class="hint">详情页只读预览；编辑请前往「配置」页。</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { resolveTemplateComponent } from './registry.js';
import {
  fetchItemTemplateConfig,
  generateItemTemplateConfig,
  saveItemTemplateConfig,
} from '@/services/fitnessService.js';

const props = defineProps({
  itemId: { type: String, required: true },
  item: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  templateCode: { type: String, default: null },
});

const emit = defineEmits([ 'saved', 'loaded' ]);

const loading = ref(false);
const saving = ref(false);
const generating = ref(false);
const editMode = ref('manual');
const schemeRole = ref('primary');
const templateMeta = ref(null);
const localConfig = ref({});
const localThreshold = ref({});
const configSource = ref('manual');
const loadedItem = ref(null);

const item = computed(() => props.item || loadedItem.value);

const hasSecondaryScheme = computed(() => Boolean(item.value?.scheme_secondary_id));

const activeSchemeId = computed(() => {
  if (schemeRole.value === 'secondary') {
    return item.value?.scheme_secondary_id || templateMeta.value?.scheme_id;
  }
  return templateMeta.value?.scheme_id || item.value?.scheme_primary_id;
});

const panelComponent = computed(() =>
  resolveTemplateComponent(templateMeta.value?.template_code || props.templateCode || 'TPL-DET'),
);

const supportsAgent = computed(() =>
  Boolean(templateMeta.value?.agent_skill) && schemeRole.value === 'primary',
);

async function load() {
  if (!props.itemId) return;
  loading.value = true;
  try {
    const data = await fetchItemTemplateConfig(props.itemId, { scheme_role: schemeRole.value });
    templateMeta.value = data.template;
    loadedItem.value = { ...(props.item || {}), item_id: props.itemId, ...data.item };
    localConfig.value = data.config_json || {};
    localThreshold.value = data.threshold_json || {};
    configSource.value = data.config_source || 'manual';
    emit('loaded', data);
  } finally {
    loading.value = false;
  }
}

async function onSchemeRoleChange() {
  editMode.value = 'manual';
  await load();
}

async function save() {
  saving.value = true;
  try {
    const data = await saveItemTemplateConfig(props.itemId, {
      scheme_role: schemeRole.value,
      config_json: localConfig.value,
      threshold_json: localThreshold.value,
      sample_set_id: localConfig.value.sample_set_id,
      config_source: 'manual',
    });
    configSource.value = data.config_source || 'manual';
    ElMessage.success(schemeRole.value === 'secondary' ? '辅方案配置已保存' : '主方案配置已保存');
    emit('saved', data);
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function runGenerate(autoSave) {
  generating.value = true;
  try {
    const data = await generateItemTemplateConfig(props.itemId, { auto_save: autoSave });
    localConfig.value = data.config_json || {};
    localThreshold.value = data.threshold_json || {};
    configSource.value = data.config_source || 'agent';
    if (autoSave) {
      ElMessage.success('Agent 配置已生成并保存');
      emit('saved', data);
    } else {
      ElMessage.success('Agent 配置已生成，请预览后手动保存');
      editMode.value = 'manual';
    }
  } catch (e) {
    ElMessage.error(e.message || 'Agent 生成失败');
  } finally {
    generating.value = false;
  }
}

watch(() => props.itemId, () => {
  schemeRole.value = 'primary';
  load();
}, { immediate: true });

watch(() => props.item?.scheme_secondary_id, (next, prev) => {
  if (!next && schemeRole.value === 'secondary') {
    schemeRole.value = 'primary';
    load();
  } else if (next && !prev && props.itemId) {
    load();
  }
});
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; margin-bottom: 12px; }
.agent-panel { margin-bottom: 12px; }
</style>
