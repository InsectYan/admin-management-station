<template>
  <div class="ops-directory">
    <div v-if="!readonly" class="ops-directory__toolbar">
      <el-button size="small" @click="addRoot">新增根目录 / 文件</el-button>
      <span class="ops-directory__hint">只给真正参与的页面绑一条流程；支撑目录留空。进入流程仅打开已绑定的那一条。</span>
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
          <template v-if="readonly">
            <el-tag size="small">{{ data.type === 'file' ? '文件' : '目录' }}</el-tag>
            <strong>{{ data.name || '未命名' }}</strong>
            <span class="ops-directory__desc">{{ data.description }}</span>
          </template>
          <template v-else>
            <el-select v-model="data.type" size="small" style="width: 88px" @change="onTypeChange(data)">
              <el-option label="目录" value="dir" />
              <el-option label="文件" value="file" />
            </el-select>
            <el-input v-model="data.name" size="small" placeholder="名称" style="width: 160px" />
            <el-input v-model="data.description" size="small" placeholder="说明" style="flex: 1" />
            <el-select
              v-model="data.flow_key"
              size="small"
              clearable
              placeholder="绑定流程"
              style="width: 140px"
            >
              <el-option
                v-for="flow in flows"
                :key="flow.key"
                :label="flow.name"
                :value="flow.key"
              />
            </el-select>
            <el-button v-if="data.type === 'dir'" link type="primary" @click="addChild(data)">加子项</el-button>
            <el-button link type="danger" @click="removeNode(modelValue, data)">删除</el-button>
          </template>
          <el-dropdown
            v-if="flowsFor(data).length"
            trigger="click"
            @command="(key) => $emit('enter-flow', key)"
          >
            <el-button link type="primary">进入流程</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="flow in flowsFor(data)"
                  :key="flow.key"
                  :command="flow.key"
                >
                  {{ flow.name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span v-else class="ops-directory__desc">未绑定</span>
        </div>
      </template>
    </el-tree>
    <el-empty v-if="!modelValue.length" description="暂无目录，可生成配置或手动添加" />
  </div>
</template>

<script setup>
import { flowsForTarget } from '../../utils/opsMeta.js';

const props = defineProps({
  modelValue: { type: Array, required: true },
  readonly: { type: Boolean, default: false },
  flows: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'enter-flow']);

function nextKey() {
  return `tree-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createNode() {
  return {
    __key: nextKey(),
    name: '',
    type: 'dir',
    description: '',
    flow_key: '',
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

function flowsFor(data) {
  return flowsForTarget(props.flows, {
    flow_key: data.flow_key,
    name: data.name,
    path: data.name,
    component: data.name,
  });
}
</script>

<style scoped>
.ops-directory__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ops-directory__hint,
.ops-directory__desc {
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
