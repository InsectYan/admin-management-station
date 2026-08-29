<template>
  <el-drawer
    :model-value="visible"
    :title="novel?.title || '小说详情'"
    size="480px"
    destroy-on-close
    @close="$emit('close')"
  >
    <template v-if="novel">
      <div class="novel-detail-cover">
        <el-image
          v-if="novel.cover_url"
          :src="novel.cover_url"
          fit="cover"
          class="novel-detail-cover__img"
        >
          <template #error>
            <div class="novel-detail-cover__fallback">{{ coverFallback(novel.title) }}</div>
          </template>
        </el-image>
        <div v-else class="novel-detail-cover__fallback">{{ coverFallback(novel.title) }}</div>
      </div>

      <el-descriptions :column="1" border size="small" class="novel-detail-desc">
        <el-descriptions-item label="ID">{{ novel.id }}</el-descriptions-item>
        <el-descriptions-item label="作者">{{ novel.author_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="题材">{{ novel.genre || '-' }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ novel.novel_type || '-' }}</el-descriptions-item>
        <el-descriptions-item label="进度">
          {{ progressLabel(novel.progress_status) }}
          <span v-if="novel.progress_status === 'ongoing'">（{{ novel.progress_percent || 0 }}%）</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">{{ novel.status || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(novel.created_at) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(novel.updated_at) || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="novel.summary" class="novel-detail-summary">
        <div class="novel-detail-summary__label">简介</div>
        <NovelMarkdown :source="novel.summary" />
      </div>
    </template>
    <div v-else v-loading="loading" style="min-height: 120px" />
  </el-drawer>
</template>

<script setup>
import NovelMarkdown from './markdown/NovelMarkdown.vue';
import { formatDateTime } from '../../utils/formatDateTime.js';
import { coverFallback, progressLabel } from '../../utils/novelMeta.js';

defineProps({
  visible: { type: Boolean, default: false },
  novel: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});

defineEmits(['close']);
</script>

<style scoped>
.novel-detail-cover {
  margin-bottom: 16px;
}

.novel-detail-cover__img,
.novel-detail-cover__fallback {
  width: 120px;
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
}

.novel-detail-cover__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--novel-gradient-cover);
  color: var(--novel-color-primary);
  font-size: 36px;
  font-weight: 600;
}

.novel-detail-desc {
  margin-bottom: 16px;
}

.novel-detail-summary__label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  font-weight: 500;
}

.novel-detail-summary :deep(.novel-md) {
  font-size: 14px;
  line-height: 1.7;
  color: var(--novel-color-text);
}
</style>
