<template>

  <PageShell :title="form.name || '接口模板详情'" v-loading="loading">

    <template #extra>

      <el-button @click="$router.push('/config/api-templates')">返回列表</el-button>

      <el-button type="primary" :loading="saving" @click="save">保存</el-button>

    </template>



    <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">

      <template #title>外部入参统一规则（TPL-API-CTX / 接口模板共用）</template>

      <ul class="rule-list">

        <li><strong>context</strong>：进入变量池，供 Body/URL 模板 <code v-pre>{{key}}</code> 与前置链路使用</li>

        <li><strong>query</strong>：GET/DELETE 等无 Body 方法默认落点，拼接到 Query String</li>

        <li><strong>body</strong>：POST/PUT/PATCH 默认落点，按 json_path 写入 Body JSON</li>

        <li><strong>path</strong>：替换 URL 中的 <code>:key</code> 或 <code v-pre>{{key}}</code></li>

        <li><strong>header</strong>：写入请求头</li>

        <li>用例侧填写的 <code>input_params</code> 与模板默认值合并后，按 bind_to 统一渲染；inject_schema 用于样本/手动可变字段</li>

      </ul>

    </el-alert>



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

          </el-form>

        </el-card>



        <el-card shadow="never" style="margin-top:16px">

          <template #header>

            <span>外部入参声明 (input_params_schema)</span>

            <el-button type="primary" link style="float:right;margin-left:8px" @click="addInputParam">添加入参</el-button>

            <el-button type="primary" link style="float:right" @click="triggerParamImport">导入 JSON</el-button>

            <input ref="paramImportRef" type="file" accept=".json,application/json" style="display:none" @change="onParamImport" />

          </template>

          <p class="hint">声明 key、传入方式 bind_to、默认值；用例配置页填写 input_params 覆盖默认值</p>

          <el-table :data="form.input_params_schema" size="small" border>

            <el-table-column label="key" width="110">

              <template #default="{ row }">

                <el-input v-model="row.key" size="small" placeholder="coach_id" />

              </template>

            </el-table-column>

            <el-table-column label="显示名" min-width="90">

              <template #default="{ row }">

                <el-input v-model="row.label" size="small" />

              </template>

            </el-table-column>

            <el-table-column label="传入方式" width="120">

              <template #default="{ row }">

                <el-select v-model="row.bind_to" size="small" @change="onBindToChange(row)">

                  <el-option v-for="o in bindOptions" :key="o.value" :label="o.label" :value="o.value" />

                </el-select>

              </template>

            </el-table-column>

            <el-table-column label="json_path" width="110">

              <template #default="{ row }">

                <el-input

                  v-model="row.json_path"

                  size="small"

                  :disabled="row.bind_to !== 'body'"

                  placeholder="默认同 key"

                />

              </template>

            </el-table-column>

            <el-table-column label="默认值" width="100">

              <template #default="{ row }">

                <el-input v-model="row.default" size="small" />

              </template>

            </el-table-column>

            <el-table-column label="操作" width="60">

              <template #default="{ $index }">

                <el-button link type="danger" @click="form.input_params_schema.splice($index, 1)">删</el-button>

              </template>

            </el-table-column>

          </el-table>

        </el-card>



        <el-card shadow="never" style="margin-top:16px">

          <template #header>前置链路 (preflight_steps)</template>

          <p class="hint">执行一次；extract 写入变量池，供主请求 Body 模板 <code v-pre>{{key}}</code> 使用</p>

          <ChainStepTable v-model="preflightSteps" show-input-params />

        </el-card>



        <el-card shadow="never" style="margin-top:16px">

          <template #header>主请求 HTTP</template>

          <el-form label-width="110px">

            <el-form-item label="HTTP 方法">

              <el-select v-model="form.http_method" style="width:120px" @change="onMethodChange">

                <el-option v-for="m in methods" :key="m" :label="m" :value="m" />

              </el-select>

            </el-form-item>

            <el-form-item label="URL 路径">

              <el-input v-model="form.url_path" placeholder="/api/chat/turns/submit" />

            </el-form-item>

            <el-form-item label="期望状态码">

              <el-input-number v-model="form.expect_status" :min="100" :max="599" />

            </el-form-item>

            <el-form-item label="Query 模板">

              <el-input v-model="queryText" type="textarea" :rows="3" @blur="parseQuery" />

              <p class="hint">JSON 对象；可与 bind_to=query 的外部入参叠加；支持 <code v-pre>{{key}}</code></p>

            </el-form-item>

            <el-form-item label="请求头 JSON">

              <el-input v-model="headersText" type="textarea" :rows="2" @blur="parseHeaders" />

            </el-form-item>

            <el-form-item v-if="needsBody" label="Body 模板">

              <el-input v-model="bodyText" type="textarea" :rows="10" @blur="parseBody" />

              <p class="hint">

                JSON 对象；bind_to=body 的外部入参按 json_path 写入；inject_schema 覆盖可变字段（含数组下标如 items.0.message）

              </p>

            </el-form-item>

            <el-form-item v-else label="Body">

              <p class="hint">{{ form.http_method }} 无请求体；外部入参请使用 query / path / header / context</p>

            </el-form-item>

            <el-form-item label="Forbidden">

              <el-input v-model="forbiddenText" placeholder="plan_form,training_plan" />

            </el-form-item>

            <el-form-item label="Poll 配置">

              <el-switch v-model="pollEnabled" />

              <template v-if="pollEnabled">

                <el-input

                  v-model="pollPath"

                  size="small"

                  style="margin-top:8px"

                  placeholder="/api/chat/turns/{{turn_id}}"

                />

                <p class="hint">submit 后 poll；until status=done；forbidden 在 poll 响应校验</p>

              </template>

            </el-form-item>

          </el-form>

        </el-card>



        <el-card shadow="never" style="margin-top:16px">

          <template #header>

            <span>可注入字段 → Body 映射</span>

            <el-button type="primary" link style="float:right" @click="addInjectField">添加字段</el-button>

          </template>

          <p class="hint">样本集/手动输入的可变字段（如 message）；与外部入参互补，执行时 inject 覆盖同路径</p>

          <el-table :data="form.inject_schema" size="small" border>

            <el-table-column prop="key" label="字段 key" width="110">

              <template #default="{ row }">

                <el-input v-model="row.key" size="small" />

              </template>

            </el-table-column>

            <el-table-column prop="label" label="显示名" min-width="90">

              <template #default="{ row }">

                <el-input v-model="row.label" size="small" />

              </template>

            </el-table-column>

            <el-table-column prop="location" label="位置" width="90">

              <template #default="{ row }">

                <el-select v-model="row.location" size="small">

                  <el-option label="body" value="body" />

                  <el-option label="header" value="header" />

                  <el-option label="query" value="query" />

                  <el-option label="path" value="path" />

                </el-select>

              </template>

            </el-table-column>

            <el-table-column prop="json_path" label="JSON 路径" min-width="140">

              <template #default="{ row }">

                <el-input v-model="row.json_path" size="small" placeholder="message 或 items.0.text" />

              </template>

            </el-table-column>

            <el-table-column label="操作" width="60">

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

import ChainStepTable from '@/views/fitness/execution/config/ChainStepTable.vue';

import { fetchApiTemplate, updateApiTemplate } from '@/services/fitnessService.js';

import { methodNeedsBody } from '@/utils/httpRequestBody.js';

import {

  PARAM_BIND_OPTIONS,

  inferParamBindTo,

  parseApiTemplateImportJson,

} from '@/utils/apiTemplateParamBind.js';



const route = useRoute();

const loading = ref(false);

const saving = ref(false);

const linkedItems = ref([]);

const paramImportRef = ref(null);

const methods = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ];

const bindOptions = PARAM_BIND_OPTIONS;

const preflightSteps = ref([]);

const pollEnabled = ref(true);

const pollPath = ref('/api/chat/turns/{{turn_id}}');

const forbiddenText = ref('plan_form,training_plan');



const form = reactive({

  id: null,

  template_code: '',

  name: '',

  description: '',

  project_code: '',

  http_method: 'POST',

  url_path: '/',

  expect_status: 202,

  headers_json: {},

  query_json: {},

  body_template: {},

  inject_schema: [],

  input_params_schema: [],

});



const headersText = ref('{}');

const queryText = ref('{}');

const bodyText = ref('{}');



const needsBody = computed(() => methodNeedsBody(form.http_method));



const previewJson = computed(() => JSON.stringify({

  input_params_schema: form.input_params_schema,

  preflight_steps: preflightSteps.value,

  method: form.http_method,

  path: form.url_path,

  query_json: form.query_json,

  expect_status: form.expect_status,

  body: needsBody.value ? form.body_template : undefined,

  inject_schema: form.inject_schema,

  forbidden_patterns: forbiddenText.value.split(',').map(s => s.trim()).filter(Boolean),

  poll_json: pollEnabled.value ? { path: pollPath.value, until_json_path: '$.status', until_value: 'done' } : {},

}, null, 2));



function syncJsonTexts() {

  headersText.value = JSON.stringify(form.headers_json || {}, null, 2);

  queryText.value = JSON.stringify(form.query_json || {}, null, 2);

  bodyText.value = JSON.stringify(form.body_template || {}, null, 2);

}



function parseJsonField(text, field) {

  try {

    form[field] = JSON.parse(text || '{}');

  } catch {

    ElMessage.error(`${field} JSON 无效`);

  }

}



function parseHeaders() { parseJsonField(headersText.value, 'headers_json'); }

function parseQuery() { parseJsonField(queryText.value, 'query_json'); }

function parseBody() { parseJsonField(bodyText.value, 'body_template'); }



function defaultBindTo() {

  return inferParamBindTo(form.http_method, '', form.url_path);

}



function addInjectField() {

  form.inject_schema.push({ key: '', label: '', location: 'body', json_path: '' });

}



function addInputParam() {

  form.input_params_schema.push({

    key: '',

    label: '',

    default: '',

    bind_to: defaultBindTo(),

    json_path: '',

  });

}



function onBindToChange(row) {

  if (row.bind_to === 'body' && !row.json_path && row.key) {

    row.json_path = row.key;

  }

}



function onMethodChange() {

  for (const row of form.input_params_schema) {

    if (!row.bind_to || row.bind_to === 'body' || row.bind_to === 'query') {

      row.bind_to = inferParamBindTo(form.http_method, row.key, form.url_path);

    }

  }

}



function triggerParamImport() {

  paramImportRef.value?.click();

}



async function onParamImport(ev) {

  const file = ev.target.files?.[0];

  ev.target.value = '';

  if (!file) return;

  try {

    const imported = parseApiTemplateImportJson(await file.text());

    if (imported.http_method) form.http_method = imported.http_method;

    if (imported.url_path) form.url_path = imported.url_path;

    if (imported.headers_json) form.headers_json = imported.headers_json;

    if (imported.query_json) form.query_json = imported.query_json;

    if (imported.body_template) form.body_template = imported.body_template;

    if (imported.inject_schema?.length) form.inject_schema = imported.inject_schema;

    if (imported.preflight_steps?.length) preflightSteps.value = imported.preflight_steps;

    if (imported.input_params_schema?.length) {

      form.input_params_schema = imported.input_params_schema.map(p => ({

        ...p,

        bind_to: p.bind_to || inferParamBindTo(form.http_method, p.key, form.url_path),

        json_path: p.json_path || p.key || '',

      }));

    }

    syncJsonTexts();

    ElMessage.success('已导入模板参数');

  } catch (e) {

    ElMessage.error(e.message || '导入失败');

  }

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

      expect_status: data.expect_status ?? 202,

      headers_json: data.headers_json || {},

      query_json: data.query_json || {},

      body_template: data.body_template || {},

      inject_schema: Array.isArray(data.inject_schema) ? [ ...data.inject_schema ] : [],

      input_params_schema: Array.isArray(data.input_params_schema)

        ? data.input_params_schema.map(p => ({

          ...p,

          bind_to: p.bind_to || inferParamBindTo(data.http_method, p.key, data.url_path),

          json_path: p.json_path || p.key || '',

        }))

        : [],

    });

    preflightSteps.value = Array.isArray(data.preflight_steps) ? [ ...data.preflight_steps ] : [];

    forbiddenText.value = (data.forbidden_patterns || []).join(',');

    const poll = data.poll_json || {};

    pollEnabled.value = Boolean(poll.path || poll.enabled);

    pollPath.value = poll.path || '/api/chat/turns/{{turn_id}}';

    linkedItems.value = data.linked_items || [];

    syncJsonTexts();

  } finally {

    loading.value = false;

  }

}



async function save() {

  parseHeaders();

  parseQuery();

  if (needsBody.value) parseBody();

  saving.value = true;

  try {

    await updateApiTemplate(form.id, {

      name: form.name,

      description: form.description,

      project_code: form.project_code,

      http_method: form.http_method,

      url_path: form.url_path,

      expect_status: form.expect_status,

      headers_json: form.headers_json,

      query_json: form.query_json,

      body_template: needsBody.value ? form.body_template : {},

      inject_schema: form.inject_schema.filter(f => f.key),

      input_params_schema: form.input_params_schema.filter(p => p.key).map(p => ({

        key: p.key,

        label: p.label || p.key,

        default: p.default,

        bind_to: p.bind_to || inferParamBindTo(form.http_method, p.key, form.url_path),

        json_path: p.bind_to === 'body' ? (p.json_path || p.key) : (p.json_path || ''),

      })),

      preflight_steps: preflightSteps.value,

      forbidden_patterns: forbiddenText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),

      poll_json: pollEnabled.value ? {

        enabled: true,

        path: pollPath.value,

        method: 'GET',

        expect_status: 200,

        max_attempts: 30,

        interval_ms: 2000,

        until_json_path: '$.status',

        until_value: 'done',

        forbidden_on: 'poll',

      } : {},

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

.hint { color: #909399; font-size: 12px; margin: 6px 0 12px; }

.rule-list { margin: 4px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }

.rule-list code { background: #f0f2f5; padding: 0 4px; border-radius: 2px; }

.preview {

  background: #f5f7fa;

  padding: 12px;

  border-radius: 4px;

  font-size: 12px;

  overflow: auto;

  max-height: 480px;

}

</style>

