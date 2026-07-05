<template>

  <div>

    <el-button type="primary" size="small" @click="addStep">添加步骤</el-button>

    <TableJsonImportButton array-key="steps" @import="importSteps" />

    <el-table :data="steps" size="small" border style="margin-top:12px">

      <el-table-column label="#" width="40" type="index" />

      <el-table-column label="Runner" width="90">

        <template #default="{ row }">

          <el-select v-model="row.runner" size="small" @change="sync">

            <el-option label="HTTP" value="http" />

            <el-option label="CLI" value="cli" />

          </el-select>

        </template>

      </el-table-column>

      <el-table-column label="Path / Command" min-width="160">

        <template #default="{ row }">

          <el-input

            v-if="row.runner === 'cli'"

            v-model="row.command"

            size="small"

            @input="sync"

          />

          <el-input v-else v-model="row.path" size="small" placeholder="/api/sessions" @input="sync" />

        </template>

      </el-table-column>

      <el-table-column label="Method" width="100">

        <template #default="{ row }">

          <el-select v-if="row.runner !== 'cli'" v-model="row.method" size="small" @change="sync">

            <el-option label="GET" value="GET" />

            <el-option label="POST" value="POST" />

            <el-option label="PUT" value="PUT" />

            <el-option label="PATCH" value="PATCH" />

          </el-select>

        </template>

      </el-table-column>

      <el-table-column label="Expect" width="120">

        <template #default="{ row }">

          <el-input-number

            v-if="row.runner !== 'cli'"

            v-model="row.expect_status"

            size="small"

            :min="100"

            :max="599"

            @change="sync"

          />

        </template>

      </el-table-column>

      <el-table-column min-width="180">

        <template #header>

          <ColHeaderTip

            label="Extract"

            tip="从响应 JSON 提取变量，格式 var:$.jsonPath；多组用换行、逗号或分号分隔"

          />

        </template>

        <template #default="{ row }">

          <el-input

            v-model="row.extractText"

            type="textarea"

            :rows="2"

            size="small"

            placeholder="session_id:$.session_id&#10;turn_id:$.turn_id"

            @input="sync"

          />

        </template>

      </el-table-column>

      <el-table-column min-width="140">

        <template #header>

          <ColHeaderTip label="响应说明" tip="可选备注，便于对照 JSON 字段位置，不影响执行" />

        </template>

        <template #default="{ row }">

          <el-input

            v-model="row.extract_hint"

            size="small"

            placeholder="如 session_id 在 body 根节点"

            @input="sync"

          />

        </template>

      </el-table-column>

      <el-table-column v-if="showInputParams" min-width="140">

        <template #header>

          <ColHeaderTip

            label="入参配置"

            tip="填写外部入参 key，逗号分隔；按接口模板 input_params_schema.bind_to 写入本步 HTTP（如 POST→body、GET→query）"

          />

        </template>

        <template #default="{ row }">

          <el-input

            v-model="row.input_params_text"

            size="small"

            placeholder="coach_id,user_id"

            @input="sync"

          />

        </template>

      </el-table-column>

      <el-table-column label="操作" width="60">

        <template #default="{ $index }">

          <el-button link type="danger" @click="removeStep($index)">删</el-button>

        </template>

      </el-table-column>

    </el-table>

  </div>

</template>



<script setup>

import { ref, watch, onMounted } from 'vue';

import TableJsonImportButton from '@/components/config-templates/TableJsonImportButton.vue';

import ColHeaderTip from '@/components/config-templates/ColHeaderTip.vue';

import {

  defaultChainStep,

  normalizeChainStep,

  serializeChainStep,

} from '@/utils/chainExtractUtils.js';



const props = defineProps({

  modelValue: { type: Array, default: () => [] },

  showInputParams: { type: Boolean, default: false },

});

const emit = defineEmits([ 'update:modelValue' ]);



const steps = ref([]);

let syncingFromInternal = false;



function serializedSteps() {

  return steps.value.map(serializeChainStep);

}



function sync() {

  syncingFromInternal = true;

  emit('update:modelValue', serializedSteps());

  queueMicrotask(() => {

    syncingFromInternal = false;

  });

}



function addStep() {

  steps.value.push(defaultChainStep());

  sync();

}



function removeStep(i) {

  steps.value.splice(i, 1);

  sync();

}



function importSteps(rows) {

  steps.value = rows.map(s => normalizeChainStep(s));

  sync();

}



function initFromProps() {

  const raw = props.modelValue;

  if (Array.isArray(raw) && raw.length) {

    steps.value = raw.map(s => normalizeChainStep(s));

  } else if (!steps.value.length) {

    steps.value = [ defaultChainStep() ];

  }

}



watch(() => props.modelValue, () => {

  if (syncingFromInternal) return;

  initFromProps();

}, { deep: true });

onMounted(initFromProps);

</script>


