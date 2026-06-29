<template>
  <el-card shadow="never" class="testgen-agent-config">
    <template #header>
      <div class="testgen-agent-config-header">
        <span>Agent 配置与执行状态</span>
        <el-tag v-if="context.current_phase" size="small" type="info">
          {{ phaseLabel }}
        </el-tag>
      </div>
    </template>

    <el-descriptions :column="1" border size="small">
      <el-descriptions-item label="当前模型">
        <span v-if="displayModel">{{ displayModel }}</span>
        <span v-else class="testgen-agent-config-muted">等待 Agent 上报…</span>
      </el-descriptions-item>
      <el-descriptions-item label="LLM Profile">
        <span v-if="displayLlmProfile">{{ displayLlmProfile }}</span>
        <span v-else class="testgen-agent-config-muted">未选择（主应用侧栏可切换）</span>
      </el-descriptions-item>
      <el-descriptions-item v-if="quotaLines.length" label="生成配额">
        <div v-for="line in quotaLines" :key="line">{{ line }}</div>
      </el-descriptions-item>
      <el-descriptions-item label="执行方向">
        <span class="testgen-agent-config-direction">{{ displayDirection }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <div class="testgen-agent-config-prompts">
      <ExpandableTextBlock
        title="系统提示词"
        :content="context.system_prompt"
      />
      <ExpandableTextBlock
        title="用户提示词（当前步）"
        :content="context.user_prompt"
      />
      <ExpandableTextBlock
        v-if="abnormalContent"
        title="异常内容"
        variant="error"
        :content="abnormalContent"
      />
      <ExpandableTextBlock
        v-if="fitnessDryRunText"
        title="Fitness dry-run"
        :content="fitnessDryRunText"
      />
      <ExpandableTextBlock
        v-if="fitnessSamplesText"
        title="Fitness 样本写入"
        :content="fitnessSamplesText"
      />
    </div>

    <div v-if="context.updated_at" class="testgen-agent-config-updated">
      最近更新：{{ formatTime(context.updated_at) }}
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue';
import { getLlmProfileId } from '../utils/llmProfileSession.js';
import ExpandableTextBlock from './ExpandableTextBlock.vue';

const DIRECTION_MAX = 500;

const props = defineProps({
  agentContext: {
    type: Object,
    default: () => ({}),
  },
  jobOptions: {
    type: Object,
    default: () => ({}),
  },
  testTypes: {
    type: Array,
    default: () => [],
  },
  errorMessage: {
    type: String,
    default: '',
  },
});

const phaseLabelMap = {
  analyze: '需求分析',
  functional: '功能用例',
  edge: '边界用例',
  review: '合规审查',
};

function truncate(text, max) {
  const value = String(text ?? '').trim();
  if (!value) return '等待 Agent 启动…';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

const context = computed(() => props.agentContext || {});

const displayModel = computed(() => {
  const model = context.value.model;
  const profile = context.value.llm_profile_id || getLlmProfileId();
  if (model && profile && model !== profile) return `${model} (${profile})`;
  return model || profile || '';
});

const displayLlmProfile = computed(() =>
  context.value.llm_profile_id || getLlmProfileId() || '',
);

const quotaLines = computed(() => {
  const counts = context.value.type_counts
    || props.jobOptions?.type_counts
    || {};
  const types = props.testTypes?.length
    ? props.testTypes
    : Object.keys(counts);
  return types.map(t => `${t}：${counts[t] ?? '—'} 条`);
});

const phaseLabel = computed(() =>
  phaseLabelMap[context.value.current_phase] || context.value.current_phase || '—',
);

const displayDirection = computed(() =>
  truncate(context.value.current_direction, DIRECTION_MAX),
);

const abnormalContent = computed(() => {
  const fromContext = String(context.value.abnormal_content ?? '').trim();
  const fromJob = String(props.errorMessage ?? '').trim();
  if (fromContext && fromJob && !fromContext.includes(fromJob)) {
    return `${fromContext}\n\n【任务错误】${fromJob}`;
  }
  return fromContext || fromJob;
});

const fitnessDryRunText = computed(() => {
  const dr = context.value.fitness_dry_run;
  if (!dr) return context.value.fitness_dry_run_error || '';
  return JSON.stringify(dr, null, 2);
});

const fitnessSamplesText = computed(() => {
  const s = context.value.fitness_samples;
  if (!s) return context.value.fitness_samples_error || '';
  return typeof s === 'string' ? s : JSON.stringify(s, null, 2);
});

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN');
}
</script>

