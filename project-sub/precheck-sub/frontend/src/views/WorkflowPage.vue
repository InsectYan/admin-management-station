<template>
  <PageShell title="工作流依赖">
    <div class="precheck-module">
      <h3 class="precheck-module__title">工作流列表</h3>
      <el-table :data="rows" @row-click="check">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="category" label="分类" width="160" />
      </el-table>
      <el-empty v-if="!rows.length" description="还没有工作流" />
    </div>

    <div class="precheck-module">
      <h3 class="precheck-module__title">基本信息</h3>
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="name" /></el-form-item>
        <el-form-item label="建议显存（GB）">
          <el-input v-model="suggestedVram" placeholder="留空表示不限制" />
        </el-form-item>
      </el-form>
    </div>

    <div class="precheck-module">
      <h3 class="precheck-module__title">工作流 JSON</h3>
      <el-input v-model="raw" type="textarea" :rows="8" placeholder="Save (API Format) 的内容" />
      <div style="margin-top: 12px">
        <el-button type="primary" @click="upload">导入</el-button>
        <el-button :disabled="!editingId" @click="save">保存修改</el-button>
      </div>
    </div>

    <div v-if="diff || message" class="precheck-module">
      <h3 class="precheck-module__title">依赖检查</h3>
      <el-alert v-if="message" :title="message" :type="diff?.ok ? 'success' : 'warning'" show-icon />
      <template v-if="diff">
        <p>缺失节点：{{ diff.missing_nodes.join('、') || '无' }}</p>
        <p>缺失模型：{{ diff.missing_models.map(item => item.name).join('、') || '无' }}</p>
        <p v-if="diff.low_vram">空闲显存 {{ diff.vram_free_gb }} GB，低于建议 {{ diff.suggested_vram_gb }} GB</p>
        <p v-for="item in diff.missing_models" :key="item.name">{{ item.advice }}</p>
      </template>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';

const rows = ref([]);
const name = ref('文生图夹具');
const raw = ref('');
const diff = ref(null);
const message = ref('');
const editingId = ref(null);
const suggestedVram = ref('');

async function load() { rows.value = await request('/workflows'); }

async function upload() {
  let apiJson;
  try { apiJson = JSON.parse(raw.value); } catch { ElMessage.error('JSON 无法解析'); return; }
  await request('/workflows', { method: 'post', data: { name: name.value, category: 'text_to_image', api_json: apiJson } });
  raw.value = '';
  await load();
}

async function check(row) {
  editingId.value = row.id;
  const full = await request(`/workflows/${row.id}`);
  name.value = full.name;
  suggestedVram.value = full.suggested_vram_gb ?? '';
  raw.value = JSON.stringify(full.api_json, null, 2);
  diff.value = await request(`/workflows/${row.id}/dependencies`);
  message.value = diff.value.ok ? '可用' : (diff.value.error || '有缺失项');
}

async function save() {
  let apiJson;
  try { apiJson = JSON.parse(raw.value); } catch { ElMessage.error('JSON 无法解析'); return; }
  const vram = String(suggestedVram.value).trim();
  await request(`/workflows/${editingId.value}`, {
    method: 'put',
    data: { name: name.value, api_json: apiJson, suggested_vram_gb: vram === '' ? null : Number(vram) },
  });
  await load();
  await check({ id: editingId.value });
}

onMounted(load);
</script>
