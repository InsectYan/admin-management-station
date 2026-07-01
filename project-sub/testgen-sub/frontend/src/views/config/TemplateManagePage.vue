<template>
  <PageShell title="模板管理">
    <el-form inline style="margin-bottom:16px">
      <el-form-item label="测试大类">
        <el-select
          v-model="selectedMajorId"
          filterable
          placeholder="选择大类"
          style="width:280px"
          @change="onMajorChange"
        >
          <el-option
            v-for="m in majorOptions"
            :key="m.category_major_id"
            :label="`${m.category_major_id} · ${m.name}`"
            :value="m.category_major_id"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="majorMapping" label="挂载模板">
        <el-tag type="primary">{{ majorMapping.template_code }}</el-tag>
        <span style="margin-left:8px;color:#606266">{{ majorMapping.template_name || majorMapping.name }}</span>
      </el-form-item>
    </el-form>

    <el-alert v-if="majorMapping?.is_mixed" type="warning" :closable="false" style="margin-bottom:16px">
      {{ selectedMajorId }} 为混合 TS 大类，未挂载固定模板。下方展示 scheme 默认模板预览（TPL-CHAIN）。
    </el-alert>

    <el-card v-if="previewItem && panelComponent" shadow="never">
      <template #header>
        <span>模板预览 · {{ activeTemplateCode }}</span>
        <el-tag size="small" style="margin-left:8px">只读演示</el-tag>
      </template>
      <component
        :is="panelComponent"
        :item="previewItem"
        :model-value="demoConfig"
        :threshold="demoThreshold"
        :readonly="true"
      />
    </el-card>
    <el-empty v-else-if="!loading" description="请选择大类查看模板组件" />
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import PageShell from '@/components/PageShell.vue';
import { resolveTemplateComponent, MIXED_TS_MAJORS } from '@/components/config-templates/registry.js';
import { fetchMajorTemplateMapping, fetchTestItems, fetchEnums } from '@/services/fitnessService.js';

const loading = ref(false);
const majorOptions = ref([]);
const selectedMajorId = ref('');
const majorMapping = ref(null);
const previewItem = ref(null);
const demoConfig = ref({});
const demoThreshold = ref({});

const activeTemplateCode = computed(() => {
  if (majorMapping.value?.is_mixed) return 'TPL-CHAIN';
  return majorMapping.value?.template_code || 'TPL-DET';
});

const panelComponent = computed(() => resolveTemplateComponent(activeTemplateCode.value));

async function loadMajors() {
  const data = await fetchEnums('test_category_major', { pageSize: 100 });
  majorOptions.value = (data.list || []).filter(m => !MIXED_TS_MAJORS.has(m.category_major_id));
  if (!selectedMajorId.value && majorOptions.value.length) {
    selectedMajorId.value = majorOptions.value[0].category_major_id;
  }
}

async function loadPreviewItem() {
  if (!selectedMajorId.value) return;
  const data = await fetchTestItems({
    category_major_id: selectedMajorId.value,
    page: 1,
    pageSize: 1,
  });
  const row = data.list?.[0];
  if (row) {
    previewItem.value = row;
    demoConfig.value = {
      endpoint_path: row.endpoint_path,
      test_input_example: row.test_input_example,
      http_status_expected: row.http_status_expected,
    };
    demoThreshold.value = {};
    return;
  }
  previewItem.value = {
    item_id: `${selectedMajorId.value}-DEMO-001`,
    detail_summary: `${majorMapping.value?.note || selectedMajorId.value} 演示用例`,
    validation_primary_id: majorMapping.value?.validation_primary_id || 'VS-01-EXACT',
    http_method: 'GET',
    endpoint_path: '/health',
    http_status_expected: 200,
    assertion_points: [ 'HTTP 200', '响应字段完整' ],
  };
}

async function onMajorChange() {
  loading.value = true;
  try {
    majorMapping.value = await fetchMajorTemplateMapping(selectedMajorId.value);
    await loadPreviewItem();
  } finally {
    loading.value = false;
  }
}

watch(selectedMajorId, () => {
  if (selectedMajorId.value) onMajorChange();
});

onMounted(async () => {
  loading.value = true;
  try {
    await loadMajors();
    if (selectedMajorId.value) await onMajorChange();
  } finally {
    loading.value = false;
  }
});
</script>
