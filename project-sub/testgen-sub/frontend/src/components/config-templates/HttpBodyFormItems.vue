<template>
  <div class="http-body-fields">
    <template v-if="showBody">
      <el-form-item label="请求 Body">
        <el-input
          v-model="bodyText"
          type="textarea"
          :rows="6"
          :disabled="readonly"
          :placeholder="bodyPlaceholder"
          @input="onBodyInput"
        />
        <p class="field-hint">{{ bodyHint }}</p>
        <el-alert
          v-if="bodyParseError"
          type="error"
          :closable="false"
          show-icon
          style="margin-top:8px"
        >
          Body JSON 无效：{{ bodyParseError }}。保存后执行时将无法发送请求体。
        </el-alert>
      </el-form-item>
      <el-form-item label="请求头 (JSON)">
        <el-input
          v-model="headersText"
          type="textarea"
          :rows="3"
          :disabled="readonly"
          placeholder='{ "X-Internal-Service-Key": "与 fitness-server INTERNAL_API_KEY 一致" }'
          @input="onHeadersInput"
        />
        <p class="field-hint">可选。JSON 对象，键为请求头名；submit/stream 等接口需 X-Internal-Service-Key。</p>
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
    </template>
    <el-form-item v-else label="请求 Body">
      <el-input
        v-model="bodyText"
        type="textarea"
        :rows="2"
        :disabled="readonly"
        placeholder="GET 无需 Body"
        @input="onBodyInput"
      />
      <p class="field-hint">{{ bodyHint }}</p>
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

const showBody = computed(() => methodNeedsBody(props.method));
const bodyHint = computed(() => bodyHintForMethod(props.method, props.endpointPath));
const bodyPlaceholder = computed(() => bodyPlaceholderForPath(props.endpointPath));

function patchSnapshot(patch) {
  return JSON.stringify({
    body: patch.body,
    headers: patch.headers,
    test_input_example: patch.test_input_example,
  });
}

function applyFromModel(v) {
  if (applying) return;
  const src = v || {};
  const nextBody = bodyTextFromConfig(src);
  const nextHeaders = headersTextFromConfig(src);
  if (bodyText.value === nextBody && headersText.value === nextHeaders) return;
  applying = true;
  try {
    bodyText.value = nextBody;
    headersText.value = nextHeaders;
    bodyParseError.value = '';
    headersParseError.value = '';
  } finally {
    applying = false;
  }
}

function buildPatch() {
  const method = String(props.method || 'GET').toUpperCase();
  const patch = {};

  if (methodNeedsBody(method)) {
    const parsed = parseJsonBodyText(bodyText.value);
    if (parsed.ok && parsed.value !== undefined) {
      patch.body = parsed.value;
      patch.test_input_example = bodyText.value.trim();
      bodyParseError.value = '';
    } else if (bodyText.value.trim()) {
      patch.test_input_example = bodyText.value.trim();
      delete patch.body;
      bodyParseError.value = parsed.error || 'JSON 无效';
    } else {
      patch.test_input_example = '';
      delete patch.body;
      bodyParseError.value = '';
    }
  } else {
    patch.test_input_example = bodyText.value.trim() || undefined;
    delete patch.body;
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
    }
  } else {
    patch.headers = undefined;
    headersParseError.value = '';
  }

  return patch;
}

function emitSync() {
  if (applying) return;
  const patch = buildPatch();
  const next = { ...props.modelValue, ...patch };
  if (patchSnapshot(next) === patchSnapshot(props.modelValue)) return;
  emit('update:modelValue', next);
}

function onBodyInput() {
  emitSync();
}

function onHeadersInput() {
  emitSync();
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
