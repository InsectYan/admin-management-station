<template>
  <PageShell :title="form.name || '接口模板详情'" v-loading="loading">
    <template #extra>
      <el-button @click="$router.push('/config/api-templates')">返回列表</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>基础信息</template>
          <el-form label-width="110px">
            <el-form-item label="模板编码">
              <el-input v-model="form.template_code" disabled />
            </el-form-item>
            <el-form-item label="名称">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="form.description" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="项目编码">
              <el-input v-model="form.project_code" placeholder="fitness-agent" />
            </el-form-item>
            <el-form-item label="HTTP 方法">
              <el-select v-model="form.http_method" style="width:120px">
                <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
            <el-form-item label="URL 路径">
              <el-input v-model="form.url_path" placeholder="/turns/submit" />
            </el-form-item>
            <el-form-item label="请求头 JSON">
              <el-input v-model="headersText" type="textarea" :rows="3" @blur="parseHeaders" />
            </el-form-item>
            <el-form-item label="Query JSON">
              <el-input v-model="queryText" type="textarea" :rows="2" @blur="parseQuery" />
            </el-form-item>
            <el-form-item label="Body 模板">
              <el-input v-model="bodyText" type="textarea" :rows="8" @blur="parseBody" />
              <p class="hint">JSON 对象；注入字段会按 inject_schema 覆盖对应路径</p>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" style="margin-top:16px">
          <template #header>
            <span>可注入字段</span>
            <el-button type="primary" link style="float:right" @click="addInjectField">添加字段</el-button>
          </template>
          <el-table :data="form.inject_schema" size="small" border>
            <el-table-column prop="key" label="字段 key" width="120">
              <template #default="{ row }">
                <el-input v-model="row.key" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="label" label="显示名" min-width="100">
              <template #default="{ row }">
                <el-input v-model="row.label" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="location" label="位置" width="100">
              <template #default="{ row }">
                <el-select v-model="row.location" size="small">
                  <el-option label="body" value="body" />
                  <el-option label="header" value="header" />
                  <el-option label="query" value="query" />
                  <el-option label="path" value="path" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="json_path" label="JSON 路径" min-width="120">
              <template #default="{ row }">
                <el-input v-model="row.json_path" size="small" placeholder="message" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }">
                <el-button link type="danger" @click="form.inject_schema.splice($index, 1)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never">
          <template #header>关联测试用例</template>
          <el-table :data="linkedItems" size="small" border empty-text="暂无关联用例">
            <el-table-column prop="item_id" label="用例 ID" min-width="140" />
            <el-table-column prop="item_name" label="名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="scheme_id" label="方案" width="90" />
          </el-table>
        </el-card>

        <el-card shadow="never" style="margin-top:16px">
          <template #header>预览</template>
          <pre class="preview">{{ previewJson }}</pre>
        </el-card>
      </el-col>
    </el-row>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import { fetchApiTemplate, updateApiTemplate } from '@/services/fitnessService.js';

const route = useRoute();
const loading = ref(false);
const saving = ref(false);
const linkedItems = ref([]);
const methods = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ];

const form = reactive({
  id: null,
  template_code: '',
  name: '',
  description: '',
  project_code: '',
  http_method: 'POST',
  url_path: '/',
  headers_json: {},
  query_json: {},
  body_template: {},
  inject_schema: [],
});

const headersText = ref('{}');
const queryText = ref('{}');
const bodyText = ref('{}');

const previewJson = computed(() => JSON.stringify({
  method: form.http_method,
  path: form.url_path,
  headers: form.headers_json,
  query: form.query_json,
  body: form.body_template,
  inject_schema: form.inject_schema,
}, null, 2));

function syncJsonTexts() {
  headersText.value = JSON.stringify(form.headers_json || {}, null, 2);
  queryText.value = JSON.stringify(form.query_json || {}, null, 2);
  bodyText.value = JSON.stringify(form.body_template || {}, null, 2);
}

function parseJsonField(text, field) {
  try {
    form[field] = JSON.parse(text || '{}');
  } catch (e) {
    ElMessage.error(`${field} JSON 无效`);
  }
}

function parseHeaders() {
  parseJsonField(headersText.value, 'headers_json');
}

function parseQuery() {
  parseJsonField(queryText.value, 'query_json');
}

function parseBody() {
  parseJsonField(bodyText.value, 'body_template');
}

function addInjectField() {
  form.inject_schema.push({
    key: '',
    label: '',
    location: 'body',
    json_path: '',
  });
}

async function load() {
  const id = route.params.id;
  if (!id) return;
  loading.value = true;
  try {
    const data = await fetchApiTemplate(id);
    Object.assign(form, {
      id: data.id,
      template_code: data.template_code,
      name: data.name,
      description: data.description || '',
      project_code: data.project_code || '',
      http_method: data.http_method || 'POST',
      url_path: data.url_path || '/',
      headers_json: data.headers_json || {},
      query_json: data.query_json || {},
      body_template: data.body_template || {},
      inject_schema: Array.isArray(data.inject_schema) ? [ ...data.inject_schema ] : [],
    });
    linkedItems.value = data.linked_items || [];
    syncJsonTexts();
  } finally {
    loading.value = false;
  }
}

async function save() {
  parseHeaders();
  parseQuery();
  parseBody();
  saving.value = true;
  try {
    await updateApiTemplate(form.id, {
      name: form.name,
      description: form.description,
      project_code: form.project_code,
      http_method: form.http_method,
      url_path: form.url_path,
      headers_json: form.headers_json,
      query_json: form.query_json,
      body_template: form.body_template,
      inject_schema: form.inject_schema.filter(f => f.key),
    });
    ElMessage.success('已保存');
    await load();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.hint { color: #909399; font-size: 12px; margin-top: 6px; }
.preview {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  max-height: 360px;
}
</style>
