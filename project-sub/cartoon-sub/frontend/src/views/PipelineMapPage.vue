<template>
  <PageShell title="流水线图谱">
    <div class="pipeline-map">
      <p class="cartoon-module__hint">{{ mapData.summary }} 梳理日期 {{ mapData.reviewed_at }}。</p>
      <div class="pipeline-map__toolbar">
        <el-select v-model="activeKey" placeholder="选择流程" style="width: 220px">
          <el-option v-for="flow in mapData.flows" :key="flow.key" :label="flow.name" :value="flow.key" />
        </el-select>
        <span class="pipeline-map__count">已完成 {{ doneCount }} · 未完成 {{ todoCount }}</span>
        <div class="pipeline-map__legend">
          <span><i class="is-done" />已完成</span>
          <span><i class="is-todo" />未完成</span>
          <span><i class="is-end" />开始 / 结束</span>
          <span><i class="is-branch" />分支</span>
        </div>
      </div>
      <p v-if="current" class="cartoon-module__hint">{{ current.description }}</p>
      <div v-if="current" class="pipeline-map__body">
        <div class="pipeline-map__canvas">
          <PipelineFlowGraph
            :nodes="current.nodes"
            :edges="current.edges"
            :selected-id="selectedId"
            @select="selectedId = $event"
          />
        </div>
        <aside class="pipeline-map__side">
          <h4>节点详情</h4>
          <template v-if="selected">
            <p class="pipeline-map__name">{{ selected.name }}</p>
            <el-tag :type="selected.status === 'done' ? 'success' : 'warning'" effect="plain">
              {{ selected.status === 'done' ? '已完成' : '未完成' }}
            </el-tag>
            <dl>
              <dt>类型</dt>
              <dd>{{ typeLabel(selected.type) }}</dd>
              <dt>Skill</dt>
              <dd>{{ selected.skill || '不走 Skill' }}</dd>
              <dt>执行</dt>
              <dd>{{ runnerLabel(selected.runner) }}</dd>
              <dt>说明</dt>
              <dd>{{ selected.description || '无' }}</dd>
              <dt>上游</dt>
              <dd>{{ neighborText(incoming) }}</dd>
              <dt>下游</dt>
              <dd>{{ neighborText(outgoing) }}</dd>
            </dl>
          </template>
          <p v-else class="cartoon-module__hint">点一个节点，查看它是否完成、走哪条 Skill。</p>
        </aside>
      </div>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import PageShell from '../components/PageShell.vue';
import PipelineFlowGraph from '../components/pipeline/PipelineFlowGraph.vue';
import mapData from '../data/pipelineMap.json';

const activeKey = ref(mapData.flows[0]?.key || '');
const selectedId = ref('');
const current = computed(() => mapData.flows.find(item => item.key === activeKey.value) || mapData.flows[0]);
const counted = computed(() => (current.value?.nodes || []).filter(item => item.type !== 'start' && item.type !== 'end'));
const doneCount = computed(() => counted.value.filter(item => item.status === 'done').length);
const todoCount = computed(() => counted.value.filter(item => item.status === 'todo').length);
const selected = computed(() => current.value?.nodes.find(item => item.id === selectedId.value));
const incoming = computed(() => (current.value?.edges || []).filter(item => item.target === selectedId.value));
const outgoing = computed(() => (current.value?.edges || []).filter(item => item.source === selectedId.value));

function pick(flow) {
  const nodes = flow?.nodes || [];
  const todo = nodes.find(item => item.status === 'todo');
  const body = nodes.find(item => item.type !== 'start' && item.type !== 'end');
  selectedId.value = (todo || body || nodes[0])?.id || '';
}
watch(current, flow => pick(flow), { immediate: true });

function typeLabel(type) {
  return { start: '开始', end: '结束', page: '页面', action: '动作', decision: '判断' }[type] || '动作';
}
function runnerLabel(runner) {
  return { skill: 'Skill', local: '本地', comfy: '预检 + ComfyUI', ffmpeg: '本地剪辑', none: '未接入' }[runner] || '未接入';
}
function neighborText(edges) {
  if (!edges.length) return '无';
  return edges.map(edge => {
    const id = edge.source === selectedId.value ? edge.target : edge.source;
    const node = current.value?.nodes.find(item => item.id === id);
    const name = node?.name || id;
    return edge.label ? `${name}（${edge.label}）` : name;
  }).join('、');
}
</script>

<style scoped>
.pipeline-map {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.pipeline-map__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.pipeline-map__count { color: #5c6b62; }
.pipeline-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #2c4336;
}
.pipeline-map__legend span { display: inline-flex; align-items: center; gap: 6px; }
.pipeline-map__legend i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1.5px solid;
}
.pipeline-map__legend .is-done { background: rgba(47, 138, 91, .16); border-color: #2f8a5b; }
.pipeline-map__legend .is-todo { background: rgba(230, 162, 60, .2); border-color: #e6a23c; }
.pipeline-map__legend .is-end { background: rgba(109, 138, 130, .18); border-color: #6d8a82; }
.pipeline-map__legend .is-branch { background: transparent; border-color: #e6a23c; }
.pipeline-map__body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
  overflow: hidden;
}
.pipeline-map__canvas {
  width: 100%;
  min-width: 0;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(47, 138, 91, .16);
  border-radius: 10px;
}
.pipeline-map__side {
  min-height: 0;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(47, 138, 91, .16);
  border-radius: 10px;
  padding: 12px 14px;
}
.pipeline-map__side h4 { margin: 0 0 8px; }
.pipeline-map__name { margin: 0 0 8px; font-weight: 600; }
.pipeline-map__side dl { margin: 12px 0 0; }
.pipeline-map__side dt { color: #5c6b62; margin-top: 8px; }
.pipeline-map__side dd { margin: 2px 0 0; }
</style>
