<template>
  <PageShell title="自动化配置接口模板">
    <template #extra>
      <el-button @click="router.push('/config/api-templates')">返回列表</el-button>
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
      class="api-tpl-gen-form"
    >
      <el-form-item label="项目" prop="project_code">
        <el-select
          v-model="form.project_code"
          placeholder="请选择项目"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="p in projectOptions"
            :key="p.project_code"
            :label="p.project_name"
            :value="p.project_code"
          >
            <span>{{ p.project_name }}</span>
            <span class="api-tpl-project-code">{{ p.project_code }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="关联文档" prop="document_source">
        <el-tabs v-model="docInputMode" type="card" @tab-change="onDocModeChange">
          <el-tab-pane label="上传文件" name="upload">
            <el-upload
              drag
              :auto-upload="false"
              :show-file-list="true"
              :limit="1"
              :disabled="uploading"
              accept=".pdf,.md,.markdown,.json,.yaml,.yml,.txt,.doc,.docx"
              :before-upload="beforeUpload"
              :on-change="onFileChange"
              :on-remove="onFileRemove"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                拖拽文件到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 PDF、Markdown、Word、OpenAPI 等，最大 20MB。上传后预览并确认文档内容。
                </div>
              </template>
            </el-upload>
          </el-tab-pane>
          <el-tab-pane label="粘贴文本" name="paste">
            <el-input
              v-model="pasteContent"
              type="textarea"
              :rows="6"
              placeholder="粘贴 API 文档 / OpenAPI / Markdown 内容"
            />
            <el-button style="margin-top: 8px" @click="handlePreviewPaste">
              预览文档内容
            </el-button>
          </el-tab-pane>
          <el-tab-pane label="已有文档" name="existing">
            <el-select
              v-model="form.document_id"
              placeholder="选择已有文档"
              filterable
              clearable
              style="width: 100%"
              @change="onExistingDocSelect"
            >
              <el-option
                v-for="doc in documents"
                :key="doc.id"
                :label="doc.title"
                :value="doc.id"
              />
            </el-select>
          </el-tab-pane>
        </el-tabs>
      </el-form-item>

      <el-form-item v-if="hasPreview" label="文档预览">
        <el-card shadow="never" class="api-tpl-doc-preview-card">
          <template #header>
            <div class="api-tpl-doc-preview-header">
              <span>{{ previewData.title || '文档' }}</span>
              <el-tag v-if="previewData.doc_type" size="small">{{ docTypeLabel }}</el-tag>
              <el-tag v-if="previewData.parse_ok" type="success" size="small">解析成功</el-tag>
              <el-tag v-if="contentConfirmed" type="success" size="small">已确认</el-tag>
            </div>
          </template>

          <el-descriptions :column="2" size="small" border class="api-tpl-doc-meta">
            <el-descriptions-item label="文件大小">
              {{ formatFileSize(previewData.file_size) }}
            </el-descriptions-item>
            <el-descriptions-item label="内容规模">
              {{ contentScaleLabel }}
            </el-descriptions-item>
          </el-descriptions>

          <div
            v-if="previewData.preview_mode === 'text' && previewData.preview_text"
            class="api-tpl-doc-preview-body"
          >
            <div class="api-tpl-doc-preview-hint">{{ previewHintText }}</div>
            <pre class="api-tpl-doc-preview-content">{{ previewData.preview_text }}</pre>
          </div>

          <div
            v-else-if="previewData.preview_mode === 'link'"
            class="api-tpl-doc-preview-link"
          >
            <p>该文件为 PDF / Word 等格式，无法在页面内直接展示全文。请打开原文件确认上传无误。</p>
            <el-link
              v-if="previewData.file_url"
              :href="previewData.file_url"
              target="_blank"
              type="primary"
            >
              打开原文件：{{ previewData.title }}
            </el-link>
          </div>

          <div class="api-tpl-doc-preview-actions">
            <el-button type="primary" :disabled="contentConfirmed" @click="confirmContent">
              确认文档内容
            </el-button>
            <el-button @click="clearPreview">清除</el-button>
          </div>
        </el-card>
      </el-form-item>

      <el-form-item label="备注">
        <el-input
          v-model="form.hint"
          type="textarea"
          :rows="2"
          placeholder="可选，例如：只需生成注册和登录接口；message 字段需可注入"
        />
      </el-form-item>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="生成流程：上传并确认文档 → AI 分析接口 → 生成模板草案 → 进度页确认后导入接口模板库"
      />
    </el-form>
  </PageShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import PageShell from '@/components/PageShell.vue';
import { listDocuments, previewDocument, getDocumentPreview } from '@/services/documentService';
import { startApiTemplateGeneration } from '@/services/apiTemplateGenService';
import { fetchProjects } from '@/services/projectService.js';

const PREVIEW_SNIPPET_LEN = 500;

const router = useRouter();
const formRef = ref(null);
const submitting = ref(false);
const uploading = ref(false);
const documents = ref([]);
const projectOptions = ref([]);
const docInputMode = ref('upload');
const pasteContent = ref('');
const pasteFullContent = ref('');
const contentConfirmed = ref(false);

const emptyPreview = () => ({
  staging_id: null,
  document_id: null,
  title: '',
  doc_type: '',
  file_size: null,
  preview_mode: 'text',
  preview_text: '',
  content_length: 0,
  truncated: false,
  has_text_content: false,
  parse_ok: false,
  file_url: '',
});

const previewData = ref(emptyPreview());

const form = ref({
  project_code: '',
  document_id: '',
  hint: '',
});

const rules = {
  project_code: [{ required: true, message: '请选择项目', trigger: 'change' }],
};

const selectedProject = computed(() =>
  projectOptions.value.find(p => p.project_code === form.value.project_code) || null,
);

const canSubmit = computed(() =>
  form.value.project_code && contentConfirmed.value && hasPreview.value,
);

const hasPreview = computed(() => previewData.value.parse_ok);

const docTypeLabel = computed(() => {
  const map = { markdown: 'Markdown', pdf: 'PDF', word: 'Word', openapi: 'OpenAPI' };
  return map[previewData.value.doc_type] || previewData.value.doc_type;
});

const contentScaleLabel = computed(() => {
  if (previewData.value.has_text_content) {
    return `${previewData.value.content_length} 字`;
  }
  return formatFileSize(previewData.value.content_length || previewData.value.file_size);
});

const previewHintText = computed(() => {
  if (previewData.value.truncated) {
    return `以下为预览（前 ${PREVIEW_SNIPPET_LEN} 字，共 ${previewData.value.content_length} 字）`;
  }
  return '以下为文件内容预览（生成时将使用全量内容）';
});

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildPastePreview(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const truncated = normalized.length > PREVIEW_SNIPPET_LEN;
  return {
    ...emptyPreview(),
    title: `粘贴文档 ${new Date().toLocaleString('zh-CN')}`,
    doc_type: 'markdown',
    preview_mode: 'text',
    preview_text: truncated ? normalized.slice(0, PREVIEW_SNIPPET_LEN) : normalized,
    content_length: normalized.length,
    truncated,
    has_text_content: true,
    parse_ok: true,
  };
}

async function loadDocuments() {
  try {
    const result = await listDocuments();
    documents.value = Array.isArray(result) ? result : result?.list ?? [];
  } catch (err) {
    ElMessage.warning(err.message || '加载文档列表失败');
  }
}

async function loadProjects() {
  try {
    const result = await fetchProjects({ page: 1, pageSize: 200 });
    projectOptions.value = result.list || [];
  } catch (err) {
    ElMessage.warning(err.message || '加载项目列表失败');
  }
}

function clearPreview() {
  previewData.value = emptyPreview();
  pasteFullContent.value = '';
  contentConfirmed.value = false;
  form.value.document_id = '';
}

function confirmContent() {
  if (!hasPreview.value) {
    ElMessage.warning('请先上传或粘贴文档内容');
    return;
  }
  contentConfirmed.value = true;
  ElMessage.success('文档已确认，可点击开始生成');
}

function onDocModeChange() {
  clearPreview();
  pasteContent.value = '';
}

const ALLOWED_TYPES = [
  'application/pdf', 'text/markdown', 'text/plain', 'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function beforeUpload(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = [ 'pdf', 'md', 'markdown', 'json', 'yaml', 'yml', 'txt', 'doc', 'docx' ];
  if (!ALLOWED_TYPES.includes(file.type) && !allowedExt.includes(ext)) {
    ElMessage.error('仅支持 PDF、Markdown、Word、OpenAPI 等格式');
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

  uploading.value = true;
  contentConfirmed.value = false;
  pasteFullContent.value = '';
  try {
    const result = await previewDocument(uploadFile.raw);
    previewData.value = { ...emptyPreview(), ...result };
    form.value.document_id = '';
    ElMessage.success('文件上传并解析成功，请预览并确认');
  } catch (err) {
    ElMessage.error(err.message || '文件解析失败');
    clearPreview();
  } finally {
    uploading.value = false;
  }
}

function onFileRemove() {
  clearPreview();
}

function handlePreviewPaste() {
  if (!pasteContent.value.trim()) {
    ElMessage.warning('请输入文档内容');
    return;
  }
  contentConfirmed.value = false;
  pasteFullContent.value = pasteContent.value;
  previewData.value = buildPastePreview(pasteContent.value);
  form.value.document_id = '';
  ElMessage.info('请预览并确认文档内容');
}

async function onExistingDocSelect(id) {
  if (!id) {
    clearPreview();
    return;
  }
  contentConfirmed.value = false;
  pasteFullContent.value = '';
  try {
    const result = await getDocumentPreview(id);
    previewData.value = { ...emptyPreview(), ...result, document_id: id };
    form.value.document_id = id;
    ElMessage.info('已加载文档预览，请确认内容');
  } catch (err) {
    ElMessage.error(err.message || '加载文档失败');
    clearPreview();
  }
}

async function handleStartGeneration() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  if (!contentConfirmed.value || !hasPreview.value) {
    ElMessage.warning('请先确认文档内容');
    return;
  }

  submitting.value = true;
  try {
    const options = {};
    if (form.value.hint) options.hint = form.value.hint;

    const payload = {
      project_code: form.value.project_code,
      project_name: selectedProject.value?.project_name || form.value.project_code,
      options,
    };

    if (previewData.value.staging_id) {
      payload.staging_id = previewData.value.staging_id;
    } else if (docInputMode.value === 'existing' && previewData.value.document_id) {
      payload.document_id = previewData.value.document_id;
    } else if (pasteFullContent.value) {
      payload.document_content = pasteFullContent.value;
      payload.document_title = previewData.value.title;
      payload.document_type = previewData.value.doc_type;
    }

    const result = await startApiTemplateGeneration(payload);
    const jobId = result.job_id ?? result.id;
    router.push({ name: 'api-template-gen-progress', params: { id: jobId } });
  } catch (err) {
    ElMessage.error(err.message || '创建生成任务失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadDocuments();
  loadProjects();
});
</script>

<style scoped>
.api-tpl-project-code {
  float: right;
  color: #909399;
  font-size: 12px;
}
.api-tpl-doc-preview-content {
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
}
.api-tpl-doc-preview-hint {
  margin-bottom: 8px;
  color: #909399;
  font-size: 12px;
}
.api-tpl-doc-preview-actions {
  margin-top: 12px;
}
.api-tpl-doc-preview-header {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
