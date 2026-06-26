<template>
  <PageShell title="测试范围配置">
    <template #extra>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleStartGeneration"
      >
        开始生成
      </el-button>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      class="testgen-scope-form"
    >
      <el-form-item label="业务模块" prop="module">
        <el-select
          v-model="form.module"
          placeholder="请选择业务模块"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="item in moduleOptions"
            :key="item.value ?? item"
            :label="item.label ?? item"
            :value="item.value ?? item"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="测试类型" prop="test_types">
        <el-checkbox-group v-model="form.test_types">
          <el-checkbox
            v-for="item in testTypeOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-checkbox-group>
      </el-form-item>

      <el-form-item label="关联文档" prop="document_id">
        <el-select
          v-model="form.document_id"
          placeholder="选择已有文档或上传/粘贴新建"
          filterable
          clearable
          style="width: 100%; margin-bottom: 12px"
          @change="onDocumentSelect"
        >
          <el-option
            v-for="doc in documents"
            :key="doc.id"
            :label="doc.title"
            :value="doc.id"
          />
        </el-select>

        <el-tabs v-model="docInputMode" type="card">
          <el-tab-pane label="上传文件" name="upload">
            <el-upload
              drag
              :auto-upload="false"
              :show-file-list="true"
              :limit="1"
              accept=".pdf,.md,.markdown,.json"
              :before-upload="beforeUpload"
              :on-change="onFileChange"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                拖拽文件到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 PDF、Markdown、OpenAPI JSON，最大 20MB
                </div>
              </template>
            </el-upload>
          </el-tab-pane>
          <el-tab-pane label="粘贴文本" name="paste">
            <el-input
              v-model="pasteContent"
              type="textarea"
              :rows="6"
              placeholder="粘贴 PRD / Markdown 文档内容"
            />
            <el-button
              style="margin-top: 8px"
              :loading="creatingDoc"
              @click="handleCreateFromPaste"
            >
              保存为文档
            </el-button>
          </el-tab-pane>
        </el-tabs>
      </el-form-item>

      <el-form-item label="备注">
        <el-input
          v-model="form.hint"
          type="textarea"
          :rows="2"
          placeholder="可选，传给生成任务的补充说明"
        />
      </el-form-item>
    </el-form>

    <div class="testgen-canvas-wrap">
      <VisualizeCanvas
        :module="form.module"
        :test-types="form.test_types"
        :document-title="selectedDocTitle"
      />
    </div>
  </PageShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import PageShell from '../components/PageShell.vue';
import VisualizeCanvas from '../components/VisualizeCanvas.vue';
import { listDocuments, uploadDocument, createDocument } from '../services/documentService';
import { listModules } from '../services/knowledgeService';
import { startGeneration } from '../services/generationService';

const router = useRouter();
const formRef = ref(null);
const submitting = ref(false);
const creatingDoc = ref(false);
const documents = ref([]);
const moduleOptions = ref([]);
const docInputMode = ref('upload');
const pasteContent = ref('');
const pendingFile = ref(null);

const testTypeOptions = ['功能测试', '边界值测试', 'GDPR 合规测试', '安全测试'];

const form = ref({
  module: '',
  test_types: ['功能测试'],
  document_id: '',
  hint: '',
});

const rules = {
  module: [{ required: true, message: '请选择业务模块', trigger: 'change' }],
  test_types: [{ type: 'array', min: 1, message: '至少选择一项测试类型', trigger: 'change' }],
  document_id: [{ required: true, message: '请关联文档', trigger: 'change' }],
};

const selectedDocTitle = computed(() => {
  const doc = documents.value.find((d) => d.id === form.value.document_id);
  return doc?.title || '关联文档';
});

const canSubmit = computed(() =>
  form.value.module
  && form.value.test_types.length > 0
  && form.value.document_id,
);

async function loadDocuments() {
  try {
    const result = await listDocuments();
    documents.value = Array.isArray(result) ? result : result?.items ?? [];
  } catch (err) {
    ElMessage.warning(err.message || '加载文档列表失败');
  }
}

async function loadModules() {
  try {
    const result = await listModules();
    moduleOptions.value = Array.isArray(result) ? result : result?.items ?? [
      '课程预约',
      '设备借用',
      '会员管理',
    ];
  } catch {
    moduleOptions.value = ['课程预约', '设备借用', '会员管理'];
  }
}

function onDocumentSelect(id) {
  form.value.document_id = id;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'text/markdown',
  'text/plain',
  'application/json',
];

function beforeUpload(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = ['pdf', 'md', 'markdown', 'json'];
  if (!ALLOWED_TYPES.includes(file.type) && !allowedExt.includes(ext)) {
    ElMessage.error('仅支持 PDF、Markdown、OpenAPI JSON');
    return false;
  }
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.error('文件不能超过 20MB');
    return false;
  }
  return true;
}

async function onFileChange(uploadFile) {
  if (!uploadFile?.raw) return;
  if (!beforeUpload(uploadFile.raw)) return;
  pendingFile.value = uploadFile.raw;
  try {
    const doc = await uploadDocument(uploadFile.raw, {
      title: uploadFile.name,
      module: form.value.module || undefined,
    });
    form.value.document_id = doc.id;
    await loadDocuments();
    ElMessage.success('文档上传成功');
  } catch (err) {
    ElMessage.error(err.message || '上传失败');
  }
}

async function handleCreateFromPaste() {
  if (!pasteContent.value.trim()) {
    ElMessage.warning('请输入文档内容');
    return;
  }
  creatingDoc.value = true;
  try {
    const doc = await createDocument({
      title: `粘贴文档 ${new Date().toLocaleString('zh-CN')}`,
      content: pasteContent.value,
      module: form.value.module || undefined,
      doc_type: 'markdown',
    });
    form.value.document_id = doc.id;
    await loadDocuments();
    ElMessage.success('文档已保存');
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    creatingDoc.value = false;
  }
}

async function handleStartGeneration() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const result = await startGeneration({
      document_id: form.value.document_id,
      module: form.value.module,
      test_types: form.value.test_types,
      options: form.value.hint ? { hint: form.value.hint } : undefined,
    });
    const jobId = result.job_id ?? result.id;
    router.push({ name: 'generation-progress', params: { id: jobId } });
  } catch (err) {
    ElMessage.error(err.message || '创建生成任务失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadDocuments();
  loadModules();
});
</script>
