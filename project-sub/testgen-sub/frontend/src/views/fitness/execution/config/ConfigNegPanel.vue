<template>

  <el-form label-width="120px">

    <el-form-item label="关联用例">

      <el-input :model-value="item.item_id" disabled />

    </el-form-item>

    <el-form-item label="判定">

      <el-input :model-value="item.validation_primary_id" disabled />

    </el-form-item>

    <el-form-item label="阻断率阈值 %">

      <el-input-number

        v-model="blockRateMin"

        :min="0"

        :max="100"

        :step="1"

        @change="syncThreshold"

      />

      <span class="hint-inline">VS-09-BLOCK-L/M/H 默认 70/85/95，可覆盖 block_rate_min</span>

    </el-form-item>

    <el-divider content-position="left">对抗用例 (config_json.cases)</el-divider>

    <el-button type="primary" size="small" @click="addCase">添加用例</el-button>

    <el-table :data="cases" size="small" border style="margin-top:12px">

      <el-table-column label="Path" min-width="180">

        <template #default="{ row }">

          <el-input v-model="row.path" size="small" placeholder="/api/__adv__/..." @input="sync" />

        </template>

      </el-table-column>

      <el-table-column label="Method" width="90">

        <template #default="{ row }">

          <el-select v-model="row.method" size="small" @change="sync">

            <el-option label="GET" value="GET" />

            <el-option label="POST" value="POST" />

          </el-select>

        </template>

      </el-table-column>

      <el-table-column label="Expect blocked" width="120">

        <template #default="{ row }">

          <el-switch v-model="row.expect_blocked" @change="sync" />

        </template>

      </el-table-column>

      <el-table-column label="Block statuses" min-width="160">

        <template #default="{ row }">

          <el-input

            v-model="row.block_statuses_text"

            size="small"

            placeholder="403,404,422"

            @input="onStatusesInput(row)"

          />

        </template>

      </el-table-column>

      <el-table-column label="操作" width="70">

        <template #default="{ $index }">

          <el-button link type="danger" @click="removeCase($index)">删</el-button>

        </template>

      </el-table-column>

    </el-table>

    <p class="hint">TS-07-NEG 判定对抗输入是否被阻断；VS-09 按 block_rate_min 统计 expect_blocked 用例通过率。</p>

  </el-form>

</template>



<script setup>

import { onMounted, ref, watch } from 'vue';



const props = defineProps({

  item: { type: Object, required: true },

  modelValue: { type: Object, default: () => ({}) },

  threshold: { type: Object, default: () => ({}) },

});

const emit = defineEmits([ 'update:modelValue', 'update:threshold' ]);



const cases = ref([]);

const blockRateMin = ref(95);



function defaultCase() {

  return {

    path: '/api/__adv__/probe',

    method: 'GET',

    expect_blocked: true,

    block_statuses: [ 400, 403, 404, 405, 422, 429, 500 ],

    block_statuses_text: '400,403,404,405,422,429,500',

  };

}



function sync() {

  emit('update:modelValue', {

    cases: cases.value.map(({ block_statuses_text, ...rest }) => ({ ...rest })),

  });

}



function syncThreshold() {

  emit('update:threshold', { block_rate_min: blockRateMin.value });

}



function onStatusesInput(row) {

  row.block_statuses = String(row.block_statuses_text || '')

    .split(',')

    .map(s => Number(s.trim()))

    .filter(n => Number.isFinite(n));

  sync();

}



function addCase() {

  cases.value.push(defaultCase());

  sync();

}



function removeCase(index) {

  cases.value.splice(index, 1);

  sync();

}



function initFromProps() {

  const rows = props.modelValue?.cases;

  if (Array.isArray(rows) && rows.length) {

    cases.value = rows.map(r => ({

      ...defaultCase(),

      ...r,

      block_statuses_text: (r.block_statuses || defaultCase().block_statuses).join(','),

    }));

  } else if (!cases.value.length) {

    cases.value = [ defaultCase() ];

    sync();

  }

  blockRateMin.value = props.threshold?.block_rate_min ?? 95;

}



watch(() => props.modelValue, initFromProps, { deep: true });

watch(() => props.threshold, () => {

  blockRateMin.value = props.threshold?.block_rate_min ?? blockRateMin.value;

}, { deep: true });

onMounted(initFromProps);

</script>



<style scoped>

.hint { color: #909399; font-size: 13px; margin-top: 12px; }

.hint-inline { margin-left: 12px; color: #909399; font-size: 12px; }

</style>


