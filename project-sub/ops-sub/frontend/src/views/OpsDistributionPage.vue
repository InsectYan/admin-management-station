<template>
  <PageShell title="发布">
    <h4 class="ops-block-title">渠道账号</h4>
    <el-form inline @submit.prevent="saveChannel">
      <el-input v-model="channel.name" placeholder="渠道名称" style="width: 180px" />
      <el-select v-model="channel.platform" placeholder="平台" style="width: 140px">
        <el-option label="微信" value="wechat" />
        <el-option label="抖音" value="douyin" />
        <el-option label="哔哩哔哩" value="bilibili" />
        <el-option label="其他" value="other" />
      </el-select>
      <el-input v-model="channel.secret" placeholder="密钥只保存摘要" show-password style="width: 200px" />
      <el-button type="primary" @click="saveChannel">添加渠道</el-button>
    </el-form>
    <el-table :data="channels" row-key="id">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="platform" label="平台" width="120" />
      <el-table-column prop="auth_status" label="授权" width="140" />
      <el-table-column label="密钥" width="100">
        <template #default="{ row }">{{ row.has_secret ? '已保存' : '未填写' }}</template>
      </el-table-column>
    </el-table>

    <h4 class="ops-block-title">排期</h4>
    <p>只能选择已经导出的成片，或已经发布的故事包。</p>
    <el-form inline @submit.prevent="saveRecord">
      <el-select v-model="record.channel_id" placeholder="渠道" style="width: 180px">
        <el-option v-for="item in channels" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="record.source_app" style="width: 140px">
        <el-option label="成片" value="video" />
        <el-option label="故事包" value="narrative" />
      </el-select>
      <el-input v-model="record.source_id" placeholder="成片编号或 pkg_编号" style="width: 180px" />
      <el-input v-model="record.version" placeholder="故事包版本" style="width: 120px" />
      <el-date-picker v-model="record.scheduled_at" type="datetime" placeholder="排期时间" />
      <el-button type="primary" @click="saveRecord">加入排期</el-button>
    </el-form>

    <h4 class="ops-block-title">发布记录</h4>
    <el-table :data="records" row-key="id">
      <el-table-column prop="id" label="记录" width="80" />
      <el-table-column prop="source_app" label="来源" width="110" />
      <el-table-column prop="source_id" label="来源编号" min-width="120" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column prop="reason" label="原因" min-width="160" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link @click="mark(row, 'success')">记为成功</el-button>
          <el-button link @click="mark(row, 'failed')">记为失败</el-button>
          <el-button link @click="down(row)">下架</el-button>
        </template>
      </el-table-column>
    </el-table>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { createChannel, fetchChannels, fetchRecords, finishRecord, scheduleRecord, takedownRecord } from '../services/contentOpsService.js';

const channels = ref([]);
const records = ref([]);
const channel = reactive({ name: '', platform: 'wechat', secret: '' });
const record = reactive({ channel_id: undefined, source_app: 'narrative', source_id: '', version: '', scheduled_at: '' });

async function load() {
  channels.value = await fetchChannels();
  records.value = await fetchRecords();
}

async function saveChannel() {
  try {
    await createChannel({ ...channel });
    channel.name = '';
    channel.secret = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function saveRecord() {
  try {
    await scheduleRecord({ ...record, version: record.version || undefined });
    record.source_id = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function mark(row, status) {
  try {
    const reason = status === 'failed' ? (await ElMessageBox.prompt('失败原因', '发布结果')).value : '';
    await finishRecord(row.id, { status, reason });
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.message === 'cancel') return;
    ElMessage.error(err.message || '没有记下结果');
  }
}

async function down(row) {
  try {
    const res = await ElMessageBox.prompt('下架原因', '下架');
    await takedownRecord(row.id, { reason: res.value });
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.message === 'cancel') return;
    ElMessage.error(err.message || '没有记下下架');
  }
}

onMounted(load);
</script>
