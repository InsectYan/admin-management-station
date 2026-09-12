<template>
  <div class="ops-directory">
    <div class="ops-directory__toolbar">
      <el-button size="small" @click="addRoot">新增根目录 / 文件</el-button>
      <span class="ops-directory__hint">节点可展开编辑；type 为 dir 时可继续添加子项。</span>
    </div>
    <el-tree
      :data="modelValue"
      node-key="__key"
      default-expand-all
      :expand-on-click-node="false"
      class="ops-directory__tree"
    >
      <template #default="{ data }">
        <div class="ops-directory__node">
          <el-select v-model="data.type" size="small" style="width: 88px" @change="onTypeChange(data)">
            <el-option label="目录" value="dir" />
            <el-option label="文件" value="file" />
          </el-select>
          <el-input v-model="data.name" size="small" placeholder="名称" style="width: 180px" />
          <el-input v-model="data.description" size="small" placeholder="说明" style="flex: 1" />
          <el-button v-if="data.type === 'dir'" link type="primary" @click="addChild(data)">加子项</el-button>
          <el-button link type="danger" @click="removeNode(modelValue, data)">删除</el-button>
        </div>
      </template>
    </el-tree>
    <el-empty v-if="!modelValue.length" description="暂无目录，可从模板导入或手动添加" />
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Array, required: true },
});

const emit = defineEmits(['update:modelValue']);

function nextKey() {
  return `tree-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createNode() {
  return {
    __key: nextKey(),
    name: '',
    type: 'dir',
    description: '',
    children: [],
  };
}

function addRoot() {
  emit('update:modelValue', [...props.modelValue, createNode()]);
}

function addChild(data) {
  if (!Array.isArray(data.children)) data.children = [];
  data.children.push(createNode());
}

function onTypeChange(data) {
  if (data.type === 'file') data.children = [];
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
.ops-directory__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ops-directory__hint {
  font-size: 13px;
  color: var(--ops-color-text-muted);
}

.ops-directory__node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-right: 8px;
}

.ops-directory__tree {
  background: transparent;
}
</style>
