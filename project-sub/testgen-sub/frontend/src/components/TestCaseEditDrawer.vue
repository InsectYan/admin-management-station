<template>
  <el-drawer
    v-model="visible"
    title="编辑测试用例"
    size="640px"
    destroy-on-close
    @open="onOpen"
  >
    <div v-loading="editForm.loading.value">
      <el-steps :active="editForm.activeStep.value" finish-status="success" simple style="margin-bottom: 20px">
        <el-step title="基础" />
        <el-step title="请求" />
        <el-step title="断言" />
        <el-step title="步骤" />
      </el-steps>

      <div v-show="editForm.activeStep.value === 0">
        <el-form label-width="90px">
          <el-form-item label="标题" required>
            <el-input v-model="editForm.form.title" />
          </el-form-item>
          <el-form-item label="模块">
            <el-input v-model="editForm.form.module" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="editForm.form.type">
              <el-option label="功能" value="functional" />
              <el-option label="边界" value="edge" />
              <el-option label="安全" value="security" />
              <el-option label="性能" value="performance" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="editForm.form.priority">
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div v-show="editForm.activeStep.value === 1">
        <HttpConfigForm v-model="editForm.form.http_config" :methods="editForm.HTTP_METHODS" />
      </div>

      <div v-show="editForm.activeStep.value === 2">
        <AssertRulesEditor v-model="editForm.form.http_config.assertions" />
      </div>

      <div v-show="editForm.activeStep.value === 3">
        <el-form label-width="90px">
          <el-form-item label="前置条件">
            <el-input v-model="editForm.form.preconditions" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="步骤">
            <el-input
              v-model="stepsText"
              type="textarea"
              :rows="6"
              placeholder="每行一步"
              @blur="syncSteps"
            />
          </el-form-item>
          <el-form-item label="预期结果">
            <el-input v-model="editForm.form.expected" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
      </div>
    </div>

    <template #footer>
      <div class="testgen-edit-drawer-footer">
        <el-button :disabled="editForm.activeStep.value === 0" @click="prevStep">上一步</el-button>
        <el-button v-if="editForm.activeStep.value < 3" type="primary" @click="nextStep">下一步</el-button>
        <el-button
          v-else
          type="primary"
          :loading="editForm.saving.value"
          @click="handleSave"
        >
          保存
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import HttpConfigForm from './HttpConfigForm.vue';
import AssertRulesEditor from './AssertRulesEditor.vue';
import { useTestCaseEditForm } from '../composables/useTestCaseEditForm.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  caseId: { type: [Number, String], default: null },
});

const emit = defineEmits(['update:modelValue', 'saved']);

const caseIdRef = computed(() => props.caseId);
const editForm = useTestCaseEditForm(caseIdRef);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const stepsText = ref('');

watch(
  () => editForm.form.steps,
  (steps) => {
    stepsText.value = (steps || []).map((s) => (typeof s === 'string' ? s : JSON.stringify(s))).join('\n');
  },
  { immediate: true, deep: true },
);

function syncSteps() {
  editForm.form.steps = stepsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function onOpen() {
  editForm.activeStep.value = 0;
}

function prevStep() {
  if (editForm.activeStep.value > 0) editForm.activeStep.value -= 1;
}

function nextStep() {
  if (editForm.activeStep.value < 3) editForm.activeStep.value += 1;
}

async function handleSave() {
  try {
    syncSteps();
    await editForm.save(props.caseId);
    ElMessage.success('保存成功');
    emit('saved');
    visible.value = false;
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  }
}
</script>

<style scoped>
.testgen-edit-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
