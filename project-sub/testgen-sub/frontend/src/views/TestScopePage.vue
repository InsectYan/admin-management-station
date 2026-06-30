<template>
  <PageShell title="生成测试用例">
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
            :key="item.value"
            :label="item.label"
            :value="item.value"
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

      <el-form-item v-if="form.test_types.length" label="各类型条数">
        <div class="testgen-type-counts">
          <div
            v-for="item in form.test_types"
            :key="item"
            class="testgen-type-count-row"
          >
            <span class="testgen-type-count-label">{{ item }}</span>
            <el-input-number
              v-model="form.type_counts[item]"
              :min="1"
              :max="50"
              size="small"
            />
            <span class="testgen-type-count-hint">条（单条字段上限 300 字）</span>
          </div>
        </div>
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
                  支持 PDF、Markdown、Word、OpenAPI 等，最大 20MB。上传后预览摘要或打开原文件确认。
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
              @click="handlePreviewPaste"
            >
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
        <el-card shadow="never" class="testgen-doc-preview-card">
          <template #header>
            <div class="testgen-doc-preview-header">
              <span>{{ previewData.title || '文档' }}</span>
              <el-tag v-if="previewData.doc_type" size="small">{{ docTypeLabel }}</el-tag>
              <el-tag v-if="previewData.parse_ok" type="success" size="small">解析成功</el-tag>
              <el-tag v-if="contentConfirmed" type="success" size="small">已确认</el-tag>
            </div>
          </template>

          <el-descriptions :column="2" size="small" border class="testgen-doc-meta">
            <el-descriptions-item label="文件大小">
              {{ formatFileSize(previewData.file_size) }}
            </el-descriptions-item>
            <el-descriptions-item label="内容规模">
              {{ contentScaleLabel }}
            </el-descriptions-item>
          </el-descriptions>

          <div
            v-if="previewData.preview_mode === 'text' && previewData.preview_text"
            class="testgen-doc-preview-body"
          >
            <div class="testgen-doc-preview-hint">
              {{ previewHintText }}
            </div>
            <pre class="testgen-doc-preview-content">{{ previewData.preview_text }}</pre>
          </div>

          <div
            v-else-if="previewData.preview_mode === 'link'"
            class="testgen-doc-preview-link"
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
            <el-tag v-if="previewData.has_text_content" type="info" size="small" style="margin-top: 8px">
              服务端已提取文本 {{ previewData.content_length }} 字，生成时将使用全量文本
            </el-tag>
          </div>

          <div class="testgen-doc-preview-actions">
            <el-button
              type="primary"
              :disabled="contentConfirmed"
              @click="confirmContent"
            >
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
          placeholder="可选，传给生成任务的补充说明"
        />
      </el-form-item>

      <el-collapse v-model="fitnessCollapse" class="testgen-fitness-collapse">
        <el-collapse-item title="Fitness 联动" name="fitness">
          <el-form-item label="方案 ID">
            <el-select
              v-model="fitnessContext.scheme_id"
              placeholder="选择 TS 方案（可选）"
              filterable
              clearable
              style="width: 100%"
            >
              <el-option
                v-for="s in schemeOptions"
                :key="s.scheme_id"
                :label="`${s.scheme_id} ${s.name || ''}`"
                :value="s.scheme_id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="自动样本">
            <el-checkbox v-model="fitnessContext.auto_sample">生成后写入样本集</el-checkbox>
          </el-form-item>
          <el-form-item label="自动预检">
            <el-checkbox v-model="fitnessContext.auto_dry_run">生成后 dry-run 预检</el-checkbox>
          </el-form-item>
        </el-collapse-item>
      </el-collapse>
    </el-form>
  </PageShell>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import PageShell from '../components/PageShell.vue';
import {
  listDocuments,
  previewDocument,
  getDocumentPreview,
} from '../services/documentService';
import { listModules } from '../services/knowledgeService';
import { startGeneration } from '../services/generationService';
import { fetchSchemes } from '../services/fitnessService.js';

const PREVIEW_SNIPPET_LEN = 500;

const router = useRouter();
const formRef = ref(null);
const submitting = ref(false);
const uploading = ref(false);
const documents = ref([]);
const moduleOptions = ref([]);
const docInputMode = ref('upload');
const pasteContent = ref('');
const pasteFullContent = ref('');
const contentConfirmed = ref(false);
const fitnessCollapse = ref([]);
const schemeOptions = ref([]);
const fitnessContext = ref({
  scheme_id: '',
  auto_sample: false,
  auto_dry_run: false,
});

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

const testTypeOptions = ['功能测试', '边界值测试', 'GDPR 合规测试', '安全测试'];

const DEFAULT_TYPE_COUNTS = {
  '功能测试': 5,
  '边界值测试': 3,
  'GDPR 合规测试': 2,
  '安全测试': 3,
};

const form = ref({
  module: '',
  test_types: ['功能测试'],
  type_counts: { '功能测试': DEFAULT_TYPE_COUNTS['功能测试'] },
  document_id: '',
  hint: '',
});

watch(
  () => form.value.test_types.slice(),
  (types) => {
    const next = { ...form.value.type_counts };
    for (const t of types) {
      if (next[t] == null) next[t] = DEFAULT_TYPE_COUNTS[t] || 3;
    }
    for (const key of Object.keys(next)) {
      if (!types.includes(key)) delete next[key];
    }
    form.value.type_counts = next;
  },
);

const rules = {
  module: [{ required: true, message: '请选择业务模块', trigger: 'change' }],
  test_types: [{ type: 'array', min: 1, message: '至少选择一项测试类型', trigger: 'change' }],
};

const hasPreview = computed(() => previewData.value.parse_ok);

const canSubmit = computed(() =>
  form.value.module
  && form.value.test_types.length > 0
  && contentConfirmed.value
  && hasPreview.value,
);

const docTypeLabel = computed(() => {
  const map = {
    markdown: 'Markdown',
    pdf: 'PDF',
    word: 'Word',
    openapi: 'OpenAPI',
  };
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
    return `以下为文件内容预览（仅展示前 ${PREVIEW_SNIPPET_LEN} 字，共 ${previewData.value.content_length} 字，生成时将使用全量内容）`;
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

async function loadModules() {
  try {
    const result = await listModules();
    const list = Array.isArray(result) ? result : result?.list ?? [];
    if (list.length && typeof list[0] === 'object') {
      moduleOptions.value = list.map((m) => ({
        label: m.name || m.code,
        value: m.name || m.code,
      }));
    } else {
      moduleOptions.value = list.map((name) => ({ label: name, value: name }));
    }
  } catch {
    moduleOptions.value = [
      { label: '课程预约', value: '课程预约' },
      { label: '设备借用', value: '设备借用' },
      { label: '会员管理', value: '会员管理' },
    ];
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
  ElMessage.success('文档已确认，可补充表单并提交生成（生成时将使用服务端全量内容）');
}

function onDocModeChange() {
  clearPreview();
  pasteContent.value = '';
}

const ALLOWED_TYPES = [
  'application/pdf',
  'text/markdown',
  'text/plain',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function beforeUpload(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = ['pdf', 'md', 'markdown', 'json', 'yaml', 'yml', 'txt', 'doc', 'docx'];
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
    const type_counts = Object.fromEntries(
      form.value.test_types.map(t => [ t, form.value.type_counts[t] || DEFAULT_TYPE_COUNTS[t] || 3 ]),
    );
    const options = { type_counts };
    if (form.value.hint) options.hint = form.value.hint;

    const payload = {
      module: form.value.module,
      test_types: form.value.test_types,
      options,
    };

    if (previewData.value.staging_id) {
      payload.staging_id = previewData.value.staging_id;
    } else if (docInputMode.value === 'existing' && previewData.value.document_id) {
      payload.document_id = previewData.value.document_id;
    } else     if (pasteFullContent.value) {
      payload.document_content = pasteFullContent.value;
      payload.document_title = previewData.value.title;
      payload.document_type = previewData.value.doc_type;
    }

    if (fitnessContext.value.scheme_id || fitnessContext.value.auto_sample || fitnessContext.value.auto_dry_run) {
      payload.fitness_context = {
        scheme_id: fitnessContext.value.scheme_id || undefined,
        auto_sample: fitnessContext.value.auto_sample,
        auto_dry_run: fitnessContext.value.auto_dry_run,
      };
    }

    const result = await startGeneration(payload);
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
  fetchSchemes({ pageSize: 50 }).then(data => {
    schemeOptions.value = data.list || [];
  }).catch(() => {
    schemeOptions.value = [];
  });
});
</script>
