<template>
  <div class="ops-routes">
    <el-alert
      v-if="disabled"
      type="info"
      :closable="false"
      title="后端 / Agent 的 path 记录 HTTP 接口，可绑到对应流程。"
      class="ops-routes__alert"
    />
    <template v-else>
      <div v-if="!readonly" class="ops-routes__toolbar">
        <el-button size="small" @click="addRoot">新增路由</el-button>
      </div>
      <el-table :data="modelValue" row-key="__key" default-expand-all :tree-props="{ children: 'children' }">
        <el-table-column label="path" min-width="160">
          <template #default="{ row }">
            <el-input v-if="!readonly" v-model="row.path" size="small" placeholder="/path" />
            <span v-else>{{ row.path }}</span>
          </template>
        </el-table-column>
        <el-table-column label="name" width="140">
          <template #default="{ row }">
            <el-input v-if="!readonly" v-model="row.name" size="small" />
            <span v-else>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="component" width="160">
          <template #default="{ row }">
            <el-input v-if="!readonly" v-model="row.component" size="small" />
            <span v-else>{{ row.component }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标题" width="140">
          <template #default="{ row }">
            <el-input v-if="!readonly" v-model="row.meta.title" size="small" />
            <span v-else>{{ row.meta?.title }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="!readonly" label="绑定流程" width="150">
          <template #default="{ row }">
            <el-select v-model="row.flow_key" size="small" clearable placeholder="流程">
              <el-option
                v-for="flow in flows"
                :key="flow.key"
                :label="flow.name"
                :value="flow.key"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column v-if="!readonly" label="需登录" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.meta.auth" />
          </template>
        </el-table-column>
        <el-table-column label="功能流程" width="160" fixed="right">
          <template #default="{ row }">
            <el-dropdown
              v-if="flowsFor(row).length"
              trigger="click"
              @command="(key) => $emit('enter-flow', key)"
            >
              <el-button link type="primary">进入流程</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="flow in flowsFor(row)"
                    :key="flow.key"
                    :command="flow.key"
                  >
                    {{ flow.name }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <span v-else class="ops-routes__unbound">未绑定</span>
            <template v-if="!readonly">
              <el-button link type="primary" @click="addChild(row)">子路由</el-button>
              <el-button link type="danger" @click="removeNode(modelValue, row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script setup>
import { flowsForTarget } from '../../utils/opsMeta.js';

const props = defineProps({
  modelValue: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  flows: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'enter-flow']);

function nextKey() {
  return `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createRoute() {
  return {
    __key: nextKey(),
    path: '',
    name: '',
    component: '',
    meta: { title: '', auth: false },
    flow_key: '',
    children: [],
  };
}

function addRoot() {
  emit('update:modelValue', [...props.modelValue, createRoute()]);
}

function addChild(row) {
  if (!Array.isArray(row.children)) row.children = [];
  row.children.push(createRoute());
}

function removeNode(list, target) {
  const index = list.indexOf(target);
  if (index >= 0) {
    list.splice(index, 1);
    return true;
  }
  return list.some((node) => Array.isArray(node.children) && removeNode(node.children, target));
}

function flowsFor(row) {
  return flowsForTarget(props.flows, {
    flow_key: row.flow_key,
    name: row.name,
    path: row.path,
    component: row.component,
  });
}
</script>

<style scoped>
.ops-routes__alert {
  margin-bottom: 12px;
}

.ops-routes__toolbar {
  margin-bottom: 12px;
}

.ops-routes__unbound {
  font-size: 13px;
  color: var(--ops-color-text-muted);
}
</style>
