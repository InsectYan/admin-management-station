<template>
  <div v-if="items.length" class="media-file-list">
    <div v-for="item in items" :key="item.id" class="media-file-list__cell">
      <ul class="el-upload-list el-upload-list--picture-card">
        <li class="el-upload-list__item is-success" tabindex="0">
          <video
            v-if="item.kind === 'video'"
            class="el-upload-list__item-thumbnail"
            :src="item.url"
            muted
            preload="metadata"
            @loadeddata="paintFrame"
          />
          <img v-else class="el-upload-list__item-thumbnail" :src="item.url" alt="" />
          <span class="el-upload-list__item-actions">
            <span class="el-upload-list__item-preview" title="预览" @click="open(item)">
              <el-icon><ZoomIn /></el-icon>
            </span>
            <span
              v-if="item.deletable !== false"
              class="el-upload-list__item-delete"
              title="删除"
              @click="emit('remove', item)"
            >
              <el-icon><Delete /></el-icon>
            </span>
          </span>
        </li>
      </ul>
      <p v-if="showName && item.name" class="media-file-list__name">{{ item.name }}</p>
    </div>
    <el-dialog v-model="visible" :title="current?.name || '预览'" width="720px" append-to-body destroy-on-close>
      <video v-if="current?.kind === 'video'" class="media-file-list__preview" :src="current.url" controls autoplay />
      <img v-else class="media-file-list__preview" :src="current?.url" alt="" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Delete, ZoomIn } from '@element-plus/icons-vue';

defineProps({
  items: { type: Array, default: () => [] },
  showName: { type: Boolean, default: true },
});

const emit = defineEmits([ 'remove' ]);
const visible = ref(false);
const current = ref(null);

function open(item) {
  current.value = item;
  visible.value = true;
}
function paintFrame(event) {
  const video = event.target;
  if (!video || video.currentTime > 0) return;
  const duration = Number(video.duration);
  const at = Number.isFinite(duration) && duration > 0 ? Math.min(0.1, duration / 2) : 0.1;
  try { video.currentTime = at; } catch { /* 还没拿到时长时保持首帧 */ }
}
</script>

<style scoped>
.media-file-list { display: flex; flex-wrap: wrap; gap: 8px; }
.media-file-list__cell { width: var(--el-upload-picture-card-size, 148px); }
.media-file-list .el-upload-list__item { margin: 0; }
.media-file-list__name {
  margin: 0;
  color: #5c6b62;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}
.media-file-list :deep(video.el-upload-list__item-thumbnail) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.media-file-list__preview { display: block; width: 100%; max-height: 70vh; object-fit: contain; }
</style>
