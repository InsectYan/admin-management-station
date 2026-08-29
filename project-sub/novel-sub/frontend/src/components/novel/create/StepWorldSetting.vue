<template>
  <div class="novel-step-world">
    <el-collapse v-model="activePanels" class="novel-world-collapse">
      <el-collapse-item title="时代背景" name="era">
        <el-input
          v-model="form.era"
          type="textarea"
          :rows="3"
          placeholder="描述故事发生的时代、文明阶段"
          @input="$emit('change')"
        />
      </el-collapse-item>
      <el-collapse-item title="地理与环境" name="geography">
        <el-input
          v-model="form.geography"
          type="textarea"
          :rows="3"
          placeholder="大陆、国家、地貌、气候"
          @input="$emit('change')"
        />
      </el-collapse-item>
      <el-collapse-item title="社会规则" name="social">
        <el-input
          v-model="form.social_rules"
          type="textarea"
          :rows="3"
          placeholder="政治结构、阶级、法律与习俗"
          @input="$emit('change')"
        />
      </el-collapse-item>
      <el-collapse-item title="力量体系" name="power">
        <el-input
          v-model="form.power_system"
          type="textarea"
          :rows="3"
          placeholder="魔法、修炼、科技等级等"
          @input="$emit('change')"
        />
      </el-collapse-item>
      <el-collapse-item title="科技水平" name="tech">
        <el-input
          v-model="form.technology"
          type="textarea"
          :rows="2"
          placeholder="可选：科技或文明工具"
          @input="$emit('change')"
        />
      </el-collapse-item>
      <el-collapse-item title="历史概览" name="history">
        <el-input
          v-model="form.history_notes"
          type="textarea"
          :rows="3"
          placeholder="影响当前剧情的重大历史事件"
          @input="$emit('change')"
        />
      </el-collapse-item>
    </el-collapse>

    <WorldTimeline
      :timeline="form.timeline"
      @change="$emit('change')"
      @add="addTimelineNode"
      @remove="removeTimelineNode"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import WorldTimeline from './WorldTimeline.vue';
import { createTimelineNode } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  form: { type: Object, required: true },
  focusPath: { type: String, default: '' },
});

const emit = defineEmits(['change']);

const activePanels = ref(['era', 'geography', 'social', 'power']);

const PANEL_BY_PATH = {
  era: 'era',
  geography: 'geography',
  social_rules: 'social',
  power_system: 'power',
  technology: 'tech',
  history_notes: 'history',
};

watch(
  () => props.focusPath,
  (path) => {
    const panel = PANEL_BY_PATH[path];
    if (panel && !activePanels.value.includes(panel)) {
      activePanels.value = [...activePanels.value, panel];
    }
  },
);

function addTimelineNode(node) {
  props.form.timeline.push(node || createTimelineNode());
  emit('change');
}

function removeTimelineNode(id) {
  props.form.timeline = props.form.timeline.filter((n) => n.id !== id);
  emit('change');
}
</script>

<style scoped>
.novel-step-world {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.novel-world-collapse :deep(.el-collapse-item__header) {
  color: var(--novel-color-forest);
  font-weight: 600;
  background: var(--novel-color-glass);
  border-radius: var(--novel-radius-sm);
  padding: 0 12px;
}

.novel-world-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: var(--novel-border-subtle);
}
</style>
