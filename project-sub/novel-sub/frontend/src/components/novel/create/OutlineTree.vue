<template>
  <div class="novel-outline-tree">
    <div class="novel-outline-tree__toolbar">
      <el-button size="small" class="novel-wood-button" @click="$emit('add-volume')">添加卷</el-button>
      <span class="novel-outline-tree__stats">规划字数：{{ wordTotal.toLocaleString() }}</span>
    </div>

    <el-empty v-if="!volumes.length" description="暂无大纲，点击添加卷" />

    <div v-for="(vol, vi) in volumes" :key="vol.id" class="novel-outline-volume">
      <div class="novel-outline-volume__head">
        <el-input v-model="vol.title" placeholder="卷名" @input="$emit('change')" />
        <el-input-number
          v-model="vol.word_target"
          :min="0"
          :step="1000"
          controls-position="right"
          placeholder="字数"
          @change="$emit('change')"
        />
        <el-button link type="danger" @click="removeVolume(vi)">删除卷</el-button>
      </div>

      <div v-for="(group, gi) in vol.groups" :key="group.id" class="novel-outline-group">
        <div class="novel-outline-group__head">
          <el-input v-model="group.title" placeholder="章组" @input="$emit('change')" />
          <el-input-number
            v-model="group.word_target"
            :min="0"
            :step="500"
            controls-position="right"
            @change="$emit('change')"
          />
          <el-button link type="danger" size="small" @click="removeGroup(vol, gi)">删组</el-button>
        </div>
        <div v-for="(sec, si) in group.sections" :key="sec.id" class="novel-outline-section">
          <el-input v-model="sec.title" placeholder="小节" size="small" @input="$emit('change')" />
          <el-input-number
            v-model="sec.word_target"
            :min="0"
            :step="200"
            size="small"
            controls-position="right"
            @change="$emit('change')"
          />
          <el-button link type="danger" size="small" @click="removeSection(group, si)">删</el-button>
        </div>
        <el-button size="small" link @click="addSection(group)">+ 小节</el-button>
      </div>
      <el-button size="small" class="novel-wood-button" @click="addGroup(vol)">+ 章组</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  countOutlineWords,
  createOutlineGroup,
  createOutlineSection,
} from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  volumes: { type: Array, required: true },
});

const emit = defineEmits(['change', 'add-volume']);

const wordTotal = computed(() => countOutlineWords({ volumes: props.volumes }));

function addGroup(vol) {
  vol.groups.push(createOutlineGroup({ title: `章组 ${vol.groups.length + 1}` }));
  emit('change');
}

function addSection(group) {
  group.sections.push(createOutlineSection({ title: `小节 ${group.sections.length + 1}` }));
  emit('change');
}

function removeVolume(index) {
  props.volumes.splice(index, 1);
  emit('change');
}

function removeGroup(vol, index) {
  vol.groups.splice(index, 1);
  emit('change');
}

function removeSection(group, index) {
  group.sections.splice(index, 1);
  emit('change');
}
</script>

<style scoped>
.novel-outline-tree__toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.novel-outline-tree__stats {
  color: var(--novel-color-moon);
  font-size: 14px;
}

.novel-outline-volume {
  margin-bottom: 20px;
  padding: 16px;
  border: var(--novel-border-subtle);
  border-radius: var(--novel-radius-base);
  background: var(--novel-color-surface);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
}

.novel-outline-volume__head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.novel-outline-group {
  margin: 12px 0 12px 16px;
  padding: 12px;
  border-left: 3px solid var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
  border-radius: var(--novel-radius-sm);
}

.novel-outline-group__head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.novel-outline-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 6px 0 6px 12px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.45);
  border-radius: var(--novel-radius-sm);
}
</style>
