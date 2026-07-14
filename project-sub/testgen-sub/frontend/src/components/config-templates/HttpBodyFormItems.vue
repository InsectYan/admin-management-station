<template>
  <div class="http-body-fields">
    <el-form-item v-if="showBody" label="请求 Body">
      <el-input
        v-model="bodyText"
        type="textarea"
        :rows="6"
        :disabled="readonly"
        :placeholder="bodyPlaceholder"
        @input="onBodyInput"
        @blur="onBodyBlur"
      />
      <p class="field-hint">{{ bodyHint }}</p>
      <el-alert
        v-if="bodyParseError"
        type="error"
        :closable="false"
        show-icon
        style="margin-top:8px"
      >
        Body JSON 无效：{{ bodyParseError }}。可继续编辑，失焦或变为合法 JSON 后才会写入执行配置。
      </el-alert>
    </el-form-item>
    <el-form-item v-else label="请求 Body">
      <el-input
        v-model="bodyText"
        type="textarea"
        :rows="2"
        :disabled="readonly"
        placeholder="GET 无需 Body"
        @input="onBodyInput"
        @blur="onBodyBlur"
      />
      <p class="field-hint">{{ bodyHint }}</p>
    </el-form-item>

    <el-form-item label="请求头 (JSON)">
      <el-input
        v-model="headersText"
        type="textarea"
        :rows="3"
        :disabled="readonly"
        placeholder='{ "Authorization": "Bearer {{token}}", "X-Internal-Service-Key": "..." }'
        @input="onHeadersInput"
        @blur="onHeadersBlur"
      />
      <p class="field-hint">可选。支持 <code v-pre>{{key}}</code>；合并环境全局请求头。</p>
      <el-alert
        v-if="headersParseError"
        type="error"
        :closable="false"
        show-icon
        style="margin-top:8px"
      >
        请求头 JSON 无效：{{ headersParseError }}
      </el-alert>
    </el-form-item>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  bodyHintForMethod,
  bodyPlaceholderForPath,
  bodyTextFromConfig,
  headersTextFromConfig,
  methodNeedsBody,
  parseJsonBodyText,
} from '@/utils/httpRequestBody.js';

const props = defineProps({
  method: { type: String, default: 'GET' },
  endpointPath: { type: String, default: '' },
  modelValue: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits([ 'update:modelValue' ]);

const bodyText = ref('');
const headersText = ref('');
const bodyParseError = ref('');
const headersParseError = ref('');
let applying = false;
let bodyDirty = false;
let headersDirty = false;
let syncingOut = false;

const showBody = computed(() => methodNeedsBody(props.method));
const bodyHint = computed(() => bodyHintForMethod(props.method, props.endpointPath));
const bodyPlaceholder = computed(() => bodyPlaceholderForPath(props.endpointPath));

function deepEqualJson(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function applyFromModel(v) {
  if (applying || syncingOut) return;
  const src = v || {};
  const nextBody = bodyTextFromConfig(src);
  const nextHeaders = headersTextFromConfig(src) || '{}';

  applying = true;
  try {
    // 编辑中不把父级回写的 pretty JSON 冲掉光标；仅在外部变更时同步
    if (!bodyDirty) {
      if (bodyText.value !== nextBody) bodyText.value = nextBody;
      bodyParseError.value = '';
    } else {
      // 草稿仍在编辑：若父级 content 语义等同则忽略 pretty 回写
      const draftParsed = parseJsonBodyText(bodyText.value);
      if (draftParsed.ok && src.body != null && deepEqualJson(draftParsed.value, src.body)) {
        // keep draft formatting
      } else if (!draftParsed.ok && String(src.test_input_example || '') === bodyText.value.trim()) {
        // keep incomplete draft
      }
    }

    if (!headersDirty) {
      if (headersText.value !== nextHeaders) headersText.value = nextHeaders || '{}';
      headersParseError.value = '';
    }
  } finally {
    applying = false;
  }
}

function buildPatch({ forceEmitInvalid = false } = {}) {
  const method = String(props.method || 'GET').toUpperCase();
  const patch = {};

  if (methodNeedsBody(method)) {
    const parsed = parseJsonBodyText(bodyText.value);
    if (parsed.ok && parsed.value !== undefined) {
      patch.body = parsed.value;
      // 保留用户输入原文，避免每次 keystroke pretty-print 导致无法输入
      patch.test_input_example = bodyText.value.trim();
      bodyParseError.value = '';
    } else if (bodyText.value.trim()) {
      patch.test_input_example = bodyText.value.trim();
      // 编辑中不删除已有合法 body，避免父级回刷空对象
      if (forceEmitInvalid) delete patch.body;
      bodyParseError.value = parsed.error || 'JSON 无效';
      if (!forceEmitInvalid && !parsed.ok) {
        // 输入过程：只同步原文到 example，不碰 body 对象
        return {
          test_input_example: bodyText.value,
          _draft_only: true,
        };
      }
    } else {
      patch.test_input_example = '';
      patch.body = undefined;
      bodyParseError.value = '';
    }
  } else {
    patch.test_input_example = bodyText.value.trim() || undefined;
    patch.body = undefined;
    bodyParseError.value = '';
  }

  const headersRaw = headersText.value.trim();
  if (headersRaw) {
    const h = parseJsonBodyText(headersRaw);
    if (h.ok && h.value != null && typeof h.value === 'object' && !Array.isArray(h.value)) {
      patch.headers = h.value;
      headersParseError.value = '';
    } else {
      headersParseError.value = h.error || '须为 JSON 对象';
      if (!forceEmitInvalid) {
        return { ...patch, _draft_only: true };
      }
    }
  } else {
    patch.headers = {};
    headersParseError.value = '';
  }

  return patch;
}

function emitSync(opts = {}) {
  if (applying) return;
  const patch = buildPatch(opts);
  const draftOnly = patch._draft_only;
  delete patch._draft_only;

  const next = { ...props.modelValue };
  if (draftOnly) {
    if (patch.test_input_example !== undefined) next.test_input_example = patch.test_input_example;
  } else {
    Object.assign(next, patch);
    if (patch.body === undefined) delete next.body;
  }

  syncingOut = true;
  emit('update:modelValue', next);
  queueMicrotask(() => {
    syncingOut = false;
  });
}

function onBodyInput() {
  bodyDirty = true;
  emitSync();
}

function onHeadersInput() {
  headersDirty = true;
  emitSync();
}

function onBodyBlur() {
  bodyDirty = false;
  const parsed = parseJsonBodyText(bodyText.value);
  if (parsed.ok && parsed.value !== undefined) {
    // 失焦再 pretty，不影响输入过程
    bodyText.value = JSON.stringify(parsed.value, null, 2);
  }
  emitSync({ forceEmitInvalid: true });
}

function onHeadersBlur() {
  headersDirty = false;
  const h = parseJsonBodyText(headersText.value.trim() || '{}');
  if (h.ok && h.value && typeof h.value === 'object') {
    headersText.value = JSON.stringify(h.value, null, 2);
  }
  emitSync({ forceEmitInvalid: true });
}

watch(() => props.modelValue, applyFromModel, { deep: true, immediate: true });
</script>

<style scoped>
.field-hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  margin: 6px 0 0;
}
</style>
