<template>
  <div class="ops-routes">
    <el-alert
      v-if="disabled"
      type="info"
      :closable="false"
      title="后端 / Agent 项目不展示路由。如需记录页面路径，请将类型改为前端或全栈。"
      class="ops-routes__alert"
    />
    <template v-else>
      <div class="ops-routes__toolbar">
        <el-button size="small" @click="addRoot">新增路由</el-button>
      </div>
      <el-table :data="modelValue" row-key="__key" default-expand-all :tree-props="{ children: 'children' }">
        <el-table-column label="path" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.path" size="small" placeholder="/path" />
          </template>
        </el-table-column>
        <el-table-column label="name" width="140">
          <template #default="{ row }">
            <el-input v-model="row.name" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="component" width="180">
          <template #default="{ row }">
            <el-input v-model="row.component" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="标题" width="140">
          <template #default="{ row }">
            <el-input v-model="row.meta.title" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="需登录" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.meta.auth" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="addChild(row)">子路由</el-button>
            <el-button link type="danger" @click="removeNode(modelValue, row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

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
</script>

<style scoped>
.ops-routes__alert {
  margin-bottom: 12px;
}

.ops-routes__toolbar {
  margin-bottom: 12px;
}
</style>
