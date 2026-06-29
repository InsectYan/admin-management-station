<template>

  <el-form label-width="120px">

    <el-form-item label="关联用例">

      <el-input :model-value="item.item_id" disabled />

    </el-form-item>

    <el-form-item label="判定">

      <el-input :model-value="item.validation_primary_id" disabled />

    </el-form-item>

    <el-divider content-position="left">对照臂 (config_json.pairs)</el-divider>

    <el-button type="primary" size="small" @click="addArm">添加臂</el-button>

    <el-table :data="pairs" size="small" border style="margin-top:12px">

      <el-table-column label="Role" width="120">

        <template #default="{ row }">

          <el-select v-model="row.role" size="small" @change="sync">

            <el-option label="coach" value="coach" />

            <el-option label="member" value="member" />

            <el-option label="manager" value="manager" />

          </el-select>

        </template>

      </el-table-column>

      <el-table-column label="Path" min-width="140">

        <template #default="{ row }">

          <el-input v-model="row.path" size="small" placeholder="/health" @input="sync" />

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

      <el-table-column label="Expect" width="90">

        <template #default="{ row }">

          <el-input-number v-model="row.expect_status" size="small" :min="100" :max="599" @change="sync" />

        </template>

      </el-table-column>

      <el-table-column label="Forbidden" min-width="160">

        <template #default="{ row }">

          <el-input

            v-model="row.forbidden_text"

            size="small"

            placeholder="逗号分隔，支持 regex:"

            @input="onForbiddenInput(row)"

          />

        </template>

      </el-table-column>

      <el-table-column label="操作" width="70">

        <template #default="{ $index }">

          <el-button link type="danger" @click="removeArm($index)">删</el-button>

        </template>

      </el-table-column>

    </el-table>

    <p class="hint">TS-06-PAIR 逐臂扫描 forbidden_patterns；VS-03-ZERO 要求全部子项 pass。</p>

  </el-form>

</template>



<script setup>

import { onMounted, ref, watch } from 'vue';



const props = defineProps({

  item: { type: Object, required: true },

  modelValue: { type: Object, default: () => ({}) },

});

const emit = defineEmits([ 'update:modelValue' ]);



const pairs = ref([]);



function defaultArm(role) {

  return {

    role: role || 'coach',

    path: '/health',

    method: 'GET',

    expect_status: 200,

    forbidden_patterns: [],

    forbidden_text: '',

  };

}



function sync() {

  emit('update:modelValue', {

    pairs: pairs.value.map(({ forbidden_text, ...rest }) => ({

      ...rest,

      forbidden_patterns: rest.forbidden_patterns || [],

    })),

  });

}



function onForbiddenInput(row) {

  row.forbidden_patterns = String(row.forbidden_text || '')

    .split(',')

    .map(s => s.trim())

    .filter(Boolean);

  sync();

}



function addArm() {

  const roles = [ 'coach', 'member', 'manager' ];

  const next = roles[pairs.value.length % roles.length];

  pairs.value.push(defaultArm(next));

  sync();

}



function removeArm(index) {

  pairs.value.splice(index, 1);

  sync();

}



function initFromProps() {

  const rows = props.modelValue?.pairs;

  if (Array.isArray(rows) && rows.length) {

    pairs.value = rows.map(r => ({

      ...defaultArm(),

      ...r,

      forbidden_text: (r.forbidden_patterns || []).join(', '),

    }));

  } else if (!pairs.value.length) {

    pairs.value = [ defaultArm('coach'), defaultArm('member'), defaultArm('manager') ];

    sync();

  }

}



watch(() => props.modelValue, initFromProps, { deep: true });

onMounted(initFromProps);

</script>



<style scoped>

.hint { color: #909399; font-size: 13px; margin-top: 12px; }

</style>


