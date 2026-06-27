<template>
  <el-form label-width="100px" class="testgen-http-config-form">
    <el-form-item label="Method">
      <el-select v-model="model.method" style="width: 140px">
        <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
      </el-select>
    </el-form-item>
    <el-form-item label="URL" required>
      <el-input v-model="model.url" placeholder="/api/example" />
    </el-form-item>
    <el-form-item label="Headers">
      <el-input
        v-model="headersText"
        type="textarea"
        :rows="3"
        placeholder='{"Authorization":"Bearer ..."}'
        @blur="syncHeaders"
      />
    </el-form-item>
    <el-form-item v-if="model.method !== 'GET'" label="Body">
      <el-input
        v-model="bodyText"
        type="textarea"
        :rows="5"
        placeholder="JSON 请求体"
        @blur="syncBody"
      />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Object, required: true },
  methods: {
    type: Array,
    default: () => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

const emit = defineEmits(['update:modelValue']);

const model = props.modelValue;
const headersText = ref(JSON.stringify(model.headers || {}, null, 2));
const bodyText = ref(
  model.body != null ? JSON.stringify(model.body, null, 2) : '',
);

watch(
  () => props.modelValue,
  (v) => {
    headersText.value = JSON.stringify(v.headers || {}, null, 2);
    bodyText.value = v.body != null ? JSON.stringify(v.body, null, 2) : '';
  },
);

function syncHeaders() {
  try {
    model.headers = headersText.value.trim() ? JSON.parse(headersText.value) : {};
    emit('update:modelValue', model);
  } catch {
    /* keep invalid text for user correction */
  }
}

function syncBody() {
  try {
    model.body = bodyText.value.trim() ? JSON.parse(bodyText.value) : null;
    emit('update:modelValue', model);
  } catch {
    /* keep invalid text */
  }
}
</script>
