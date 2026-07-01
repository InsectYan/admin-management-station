<template>
  <PageShell title="生成配置">
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
      <el-form-item label="项目" prop="project_code">
        <el-select
          v-model="form.project_code"
          placeholder="请选择项目"
          filterable
          style="width: 100%"
          @change="onProjectChange"
        >
          <el-option
            v-for="p in projectOptions"
            :key="p.project_code"
            :label="p.project_name"
            :value="p.project_code"
          >
            <span>{{ p.project_name }}</span>
            <span class="testgen-project-code">{{ p.project_code }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item v-if="selectedProject" label="项目 Code">
        <el-input :model-value="selectedProject.project_code" disabled />
      </el-form-item>

      <el-form-item label="测试大类" prop="category_major_ids">
        <el-select
          v-model="form.category_major_ids"
          placeholder="选择大类（可多选，决定配置模板与主方案）"
          filterable
          multiple
          collapse-tags
          collapse-tags-tooltip
          style="width: 100%"
          @change="onMajorsChange"
        >
          <el-option
            v-for="m in majorOptions"
            :key="m.category_major_id"
            :label="`${m.category_major_id} · ${m.name}`"
            :value="m.category_major_id"
          />
        </el-select>
        <div v-if="selectedMajorSummaries.length" class="testgen-major-summary-list">
          <div
            v-for="item in selectedMajorSummaries"
            :key="item.category_major_id"
            class="testgen-major-summary-row"
          >
            <span class="testgen-major-summary-label">{{ item.category_major_id }} · {{ item.category_major_name }}</span>
            <el-tag v-if="item.template_code" size="small" type="primary">{{ item.template_code }}</el-tag>
            <span v-if="item.template_name" class="testgen-major-summary-meta">{{ item.template_name }}</span>
            <span class="testgen-major-summary-meta">{{ item.scheme_id }} {{ item.scheme_name || '' }}</span>
            <span v-if="item.is_mixed" class="testgen-major-summary-hint">（混合 TS，按方案解析模板）</span>
          </div>
        </div>
      </el-form-item>

      <el-form-item v-if="form.category_major_ids.length" label="大类条数">
        <div class="testgen-type-counts">
          <div
            v-for="mid in form.category_major_ids"
            :key="mid"
            class="testgen-type-count-row"
          >
            <span class="testgen-type-count-label">{{ majorLabel(mid) }}</span>
            <el-input-number
              v-model="form.major_counts[mid]"
              :min="1"
              :max="50"
              size="small"
            />
            <span class="testgen-type-count-hint">条</span>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="主验证 (VS)" prop="validation_ids">
        <el-checkbox-group v-model="form.validation_ids">
          <el-checkbox
            v-for="item in validationOptions"
            :key="item.validation_id"
            :label="item.validation_id"
            :value="item.validation_id"
          >
            {{ item.validation_id }} {{ item.name || '' }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item v-if="schemeTargetPreview.length" label="生成目标">
        <el-table :data="schemeTargetPreview" size="small" border max-height="280">
          <el-table-column prop="category_major_name" label="测试大类" min-width="100" />
          <el-table-column label="配置模板" min-width="120">
            <template #default="{ row }">
              <span v-if="row.template_code">{{ row.template_code }}</span>
              <span v-else class="testgen-target-muted">按方案解析</span>
            </template>
          </el-table-column>
          <el-table-column prop="scheme_name" label="主方案" min-width="100" />
          <el-table-column prop="validation_name" label="主验证" min-width="100" />
          <el-table-column prop="count" label="条数" width="72" />
        </el-table>
        <div class="testgen-target-hint">
          每个大类自动关联配置模板与主方案；按上表顺序依次执行：需求分析 → 生成用例 → 合规审查后落库
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
    </el-form>
  </PageShell>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import PageShell from '../components/PageShell.vue';
import { listDocuments, previewDocument, getDocumentPreview } from '../services/documentService';
import { startGeneration } from '../services/generationService';
import { fetchEnums, fetchMajorTemplateMapping } from '../services/fitnessService.js';
import { fetchProjects } from '../services/projectService.js';

const DEFAULT_TARGET_COUNT = 5;

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
const validationOptions = ref([]);
const majorOptions = ref([]);
const majorProfiles = ref({});

const MIXED_TS_MAJORS = new Set([ 'C1', 'C2', 'C3', 'C4' ]);

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
  category_major_ids: [],
  major_counts: {},
  validation_ids: [],
  document_id: '',
  hint: '',
});

watch(
  () => form.value.category_major_ids.slice(),
  (ids) => {
    const next = { ...form.value.major_counts };
    for (const id of ids) {
      if (next[id] == null) next[id] = DEFAULT_TARGET_COUNT;
    }
    for (const key of Object.keys(next)) {
      if (!ids.includes(key)) delete next[key];
    }
    form.value.major_counts = next;
  },
);

const selectedProject = computed(() =>
  projectOptions.value.find(p => p.project_code === form.value.project_code) || null,
);

function majorLabel(majorId) {
  const row = majorOptions.value.find(m => m.category_major_id === majorId);
  return row ? `${row.category_major_id} ${row.name || ''}`.trim() : majorId;
}

function validationLabel(validationId) {
  const row = validationOptions.value.find(v => v.validation_id === validationId);
  return row ? `${row.validation_id} ${row.name || ''}`.trim() : validationId;
}

function resolveMajorProfile(majorId) {
  const cached = majorProfiles.value[majorId];
  const major = majorOptions.value.find(m => m.category_major_id === majorId);
  const scheme_id = cached?.scheme_id || major?.default_scheme_id || 'TS-01-DET';
  return {
    category_major_id: majorId,
    category_major_name: major?.name || majorId,
    template_code: cached?.template_code || null,
    template_name: cached?.template_name || null,
    scheme_id,
    scheme_name: cached?.scheme_name || major?.default_scheme_name || scheme_id,
    is_mixed: cached?.is_mixed ?? MIXED_TS_MAJORS.has(majorId),
  };
}

const selectedMajorSummaries = computed(() =>
  form.value.category_major_ids.map(id => resolveMajorProfile(id)),
);

function buildSchemeTargets() {
  const targets = [];
  for (const mid of form.value.category_major_ids) {
    const profile = resolveMajorProfile(mid);
    const major = majorOptions.value.find(m => m.category_major_id === mid);
    const validations = form.value.validation_ids.length
      ? form.value.validation_ids
      : [ major?.default_validation_id ].filter(Boolean);

    for (const vid of validations) {
      targets.push({
        category_major_id: mid,
        category_major_name: profile.category_major_name,
        template_code: profile.template_code,
        template_name: profile.template_name,
        scheme_id: profile.scheme_id,
        scheme_name: profile.scheme_name,
        validation_id: vid,
        validation_name: validationLabel(vid) || major?.default_validation_name || vid,
        count: form.value.major_counts[mid] ?? DEFAULT_TARGET_COUNT,
        is_mixed: profile.is_mixed,
      });
    }
  }
  return targets;
}

const schemeTargetPreview = computed(() => buildSchemeTargets());

const rules = {
  project_code: [{ required: true, message: '请选择项目', trigger: 'change' }],
  category_major_ids: [{ type: 'array', min: 1, message: '请至少选择一个测试大类', trigger: 'change' }],
  validation_ids: [{ type: 'array', min: 1, message: '至少选择一项主验证', trigger: 'change' }],
};

const canSubmit = computed(() =>
  form.value.project_code
  && form.value.category_major_ids.length > 0
  && form.value.validation_ids.length > 0
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

async function loadProjects() {
  try {
    const result = await fetchProjects({ page: 1, pageSize: 200 });
    projectOptions.value = result.list || [];
  } catch (err) {
    ElMessage.warning(err.message || '加载项目列表失败');
  }
}

function onProjectChange() {
  // project_name 由 selectedProject 推导
}

async function loadMajorProfile(majorId) {
  const major = majorOptions.value.find(m => m.category_major_id === majorId);
  try {
    const mapping = await fetchMajorTemplateMapping(majorId);
    majorProfiles.value = {
      ...majorProfiles.value,
      [majorId]: {
        category_major_id: majorId,
        template_code: mapping?.template_code,
        template_name: mapping?.template_name,
        scheme_id: mapping?.scheme_id || major?.default_scheme_id,
        scheme_name: mapping?.scheme_id ? mapping?.name : major?.default_scheme_name,
        is_mixed: MIXED_TS_MAJORS.has(majorId),
      },
    };
  } catch {
    majorProfiles.value = {
      ...majorProfiles.value,
      [majorId]: {
        category_major_id: majorId,
        scheme_id: major?.default_scheme_id,
        scheme_name: major?.default_scheme_name,
        is_mixed: MIXED_TS_MAJORS.has(majorId),
      },
    };
  }
}

async function onMajorsChange(ids) {
  const prev = Object.keys(majorProfiles.value);
  for (const id of ids) {
    if (!prev.includes(id)) {
      await loadMajorProfile(id);
    }
  }
  const nextProfiles = { ...majorProfiles.value };
  for (const id of prev) {
    if (!ids.includes(id)) delete nextProfiles[id];
  }
  majorProfiles.value = nextProfiles;
}

const hasPreview = computed(() => previewData.value.parse_ok);

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
    const scheme_targets = buildSchemeTargets();
    const options = {
      category_major_ids: form.value.category_major_ids,
      validation_ids: form.value.validation_ids,
      major_counts: form.value.major_counts,
      scheme_targets,
    };
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
  loadProjects();
  const pageSizeAll = 200;
  Promise.all([
    fetchEnums('test_validation_enum', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_category_major', { page: 1, pageSize: pageSizeAll }),
  ]).then(([ valRes, majorRes ]) => {
    validationOptions.value = valRes.list || [];
    majorOptions.value = majorRes.list || [];
  }).catch(() => {
    validationOptions.value = [];
    majorOptions.value = [];
  });
});
</script>

<style scoped>
.testgen-project-code {
  float: right;
  color: #909399;
  font-size: 12px;
}
.testgen-target-hint {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
.testgen-target-muted {
  color: #909399;
  font-size: 12px;
}
.testgen-major-summary-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.testgen-major-summary-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}
.testgen-major-summary-label {
  font-weight: 500;
}
.testgen-major-summary-meta {
  color: #909399;
}
.testgen-major-summary-hint {
  color: #909399;
}
</style>
