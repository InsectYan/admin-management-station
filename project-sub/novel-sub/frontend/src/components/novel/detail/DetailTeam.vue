<template>
  <section class="novel-team">
    <header>
      <h3>协作</h3>
      <p>成员账号来自登录身份。这里只记录谁在这部作品里担任作者、编辑或审核。还没有成员时，章节可以照常修改。加入成员后，只有成员能锁章。</p>
    </header>
    <el-form inline @submit.prevent="save">
      <el-input v-model="form.username" placeholder="成员账号" style="width: 180px" />
      <el-select v-model="form.role" style="width: 120px">
        <el-option label="作者" value="author" />
        <el-option label="编辑" value="editor" />
        <el-option label="审核" value="reviewer" />
      </el-select>
      <el-button type="primary" :loading="saving" @click="save">添加成员</el-button>
    </el-form>
    <el-empty v-if="!members.length" description="还没有成员" />
    <el-table v-else :data="members" size="small">
      <el-table-column prop="username" label="账号" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">{{ roleLabel(row.role) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link @click="remove(row)">移出</el-button>
        </template>
      </el-table-column>
    </el-table>

    <h4>壳上登记的成员</h4>
    <p>名单来自壳，这里只展示。作品里的作者、编辑和审核仍用上面的协作名单。</p>
    <el-alert v-if="shellNote" type="info" :title="shellNote" show-icon :closable="false" />
    <el-empty v-else-if="!shellMembers.length" description="壳上还没有登记这部作品的成员" />
    <el-table v-else :data="shellMembers" size="small">
      <el-table-column prop="username" label="账号" />
      <el-table-column prop="role_label" label="角色" width="120" />
    </el-table>

    <h4>草稿快照</h4>
    <p>回退只恢复当前草稿，已发布的故事包不变。有章节锁着时不能回退。</p>
    <el-form inline @submit.prevent="saveSnapshot">
      <el-input v-model="snapshotLabel" placeholder="快照名称" style="width: 180px" />
      <el-button :loading="snapshotSaving" @click="saveSnapshot">记下快照</el-button>
    </el-form>
    <el-empty v-if="!snapshots.length" description="还没有快照" />
    <el-table v-else :data="snapshots" size="small">
      <el-table-column prop="label" label="名称" />
      <el-table-column prop="chapter_count" label="章节正文" width="100" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link @click="restore(row)">回退到这里</el-button>
        </template>
      </el-table-column>
    </el-table>

    <h4>最近操作</h4>
    <el-empty v-if="!activity.length" description="还没有操作记录" />
    <el-table v-else :data="activity" size="small">
      <el-table-column prop="actor" label="谁" width="140" />
      <el-table-column label="做了什么" min-width="180">
        <template #default="{ row }">{{ actionLabel(row) }}</template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { addMember, createSnapshot, fetchActivity, fetchMembers, fetchShellMembers, fetchSnapshots, removeMember, restoreSnapshot } from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [ Number, String ], default: '' },
});

const members = ref([]);
const shellMembers = ref([]);
const shellNote = ref('');
const activity = ref([]);
const snapshots = ref([]);
const snapshotLabel = ref('');
const snapshotSaving = ref(false);
const saving = ref(false);
const form = reactive({ username: '', role: 'editor' });

function roleLabel(role) {
  if (role === 'author') return '作者';
  if (role === 'editor') return '编辑';
  if (role === 'reviewer') return '审核';
  return role;
}

function actionLabel(row) {
  if (row.action === 'member.add') return `加入，角色 ${roleLabel(row.detail?.role)}`;
  if (row.action === 'member.remove') return '移出项目';
  if (row.action === 'chapter.lock') return `锁定章节 ${row.chapter_id}`;
  if (row.action === 'chapter.unlock') return `解锁章节 ${row.chapter_id}`;
  if (row.action === 'snapshot.create') return `记下快照 ${row.detail?.label || ''}`;
  if (row.action === 'snapshot.restore') return `回退到快照 ${row.detail?.label || ''}`;
  return row.action;
}

async function load() {
  if (!props.novelId) return;
  members.value = await fetchMembers(props.novelId);
  try {
    const shell = await fetchShellMembers(props.novelId);
    shellMembers.value = shell.rows || [];
    shellNote.value = shell.note || '';
  } catch (err) {
    shellMembers.value = [];
    shellNote.value = err.message || '壳上的成员名单暂时读不到';
  }
  activity.value = await fetchActivity(props.novelId);
  snapshots.value = await fetchSnapshots(props.novelId);
}

async function save() {
  saving.value = true;
  try {
    await addMember(props.novelId, { username: form.username, role: form.role });
    form.username = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message || '没有加入');
  } finally {
    saving.value = false;
  }
}

async function saveSnapshot() {
  snapshotSaving.value = true;
  try {
    await createSnapshot(props.novelId, snapshotLabel.value);
    snapshotLabel.value = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message || '没有记下快照');
  } finally {
    snapshotSaving.value = false;
  }
}

async function restore(row) {
  try {
    await ElMessageBox.confirm(`回退到「${row.label}」？已发布的故事包不会改。`, '回退草稿');
    await restoreSnapshot(props.novelId, row.id);
    ElMessage.success('已回退到这个快照');
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.message === 'cancel') return;
    ElMessage.error(err.message || '没有回退');
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`移出「${row.username}」？`, '移出成员');
    await removeMember(props.novelId, row.id);
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.message === 'cancel') return;
    ElMessage.error(err.message || '没有移出');
  }
}

watch(() => props.novelId, () => load().catch(err => ElMessage.error(err.message)));
onMounted(() => load().catch(err => ElMessage.error(err.message)));
</script>
