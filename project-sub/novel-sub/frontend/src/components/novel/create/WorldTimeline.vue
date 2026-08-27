<template>
  <div class="novel-world-timeline">
    <div class="novel-world-timeline__header">
      <h4 class="novel-world-timeline__title">历史时间轴</h4>
      <el-button size="small" class="novel-wood-button" @click="addNode">添加节点</el-button>
    </div>
    <el-empty v-if="!timeline.length" description="暂无时间节点，点击添加" :image-size="64" />
    <div v-else class="novel-world-timeline__track">
      <div
        v-for="(node, index) in timeline"
        :key="node.id"
        class="novel-world-timeline__node novel-world-card"
      >
        <div class="novel-world-timeline__node-head">
          <span class="novel-world-timeline__index">{{ index + 1 }}</span>
          <el-button link type="danger" @click="$emit('remove', node.id)">删除</el-button>
        </div>
        <el-input
          v-model="node.year"
          placeholder="年代 / 纪元"
          @input="$emit('change')"
        />
        <el-input
          v-model="node.event"
          type="textarea"
          :rows="2"
          placeholder="关键事件"
          @input="$emit('change')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { createTimelineNode } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  timeline: { type: Array, required: true },
});

const emit = defineEmits(['change', 'remove', 'add']);

function addNode() {
  emit('add', createTimelineNode());
}
</script>

<style scoped>
.novel-world-timeline__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.novel-world-timeline__title {
  margin: 0;
  color: var(--novel-color-forest);
  font-size: 15px;
}

.novel-world-timeline__track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.novel-world-timeline__node {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.novel-world-timeline__node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.novel-world-timeline__index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--novel-color-primary-muted);
  color: var(--novel-color-deep);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.novel-world-card {
  padding: 12px;
  background: var(--novel-color-parchment);
  border: var(--novel-border-gold);
  border-radius: var(--novel-radius-base);
}
</style>
