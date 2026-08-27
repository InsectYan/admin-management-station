<template>
  <div class="novel-detail-outline">
    <div class="novel-detail-outline__toolbar">
      <span>规划字数：{{ wordTotal.toLocaleString() }}</span>
      <span>{{ volumes.length }} 卷</span>
    </div>

    <el-empty v-if="!volumes.length" description="暂无篇幅大纲" />

    <section
      v-for="(vol, vi) in volumes"
      :key="vol.id"
      class="novel-detail-card novel-detail-volume"
    >
      <header class="novel-detail-volume__head">
        <h3>{{ vol.title || `第 ${vi + 1} 卷` }}</h3>
        <span v-if="vol.word_target">{{ Number(vol.word_target).toLocaleString() }} 字</span>
      </header>

      <div v-for="(group, gi) in vol.groups" :key="group.id" class="novel-detail-group">
        <div class="novel-detail-group__head">
          <strong>{{ group.title || `章组 ${gi + 1}` }}</strong>
          <span v-if="group.word_target">{{ Number(group.word_target).toLocaleString() }} 字</span>
        </div>
        <ul v-if="group.sections?.length" class="novel-detail-sections">
          <li v-for="sec in group.sections" :key="sec.id">
            <span>{{ sec.title || '未命名小节' }}</span>
            <span v-if="sec.word_target" class="is-muted">{{ Number(sec.word_target).toLocaleString() }} 字</span>
          </li>
        </ul>
        <p v-else class="is-muted">该章组暂无小节</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { countOutlineWords } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  form: { type: Object, required: true },
});

const volumes = computed(() => props.form.volumes || []);
const wordTotal = computed(() => countOutlineWords({ volumes: volumes.value }));
</script>

<style scoped>
.novel-detail-outline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.novel-detail-outline__toolbar {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--novel-color-moon, #6d8a82);
}

.novel-detail-card {
  padding: 16px 18px;
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  border-radius: var(--novel-radius-base, 10px);
}

.novel-detail-volume__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.novel-detail-volume__head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-group {
  margin: 10px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
  background: var(--novel-color-primary-muted, rgba(61, 107, 79, 0.1));
  border-radius: var(--novel-radius-sm, 6px);
}

.novel-detail-group__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--novel-color-text, #2f3d34);
}

.novel-detail-sections {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.novel-detail-sections li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: var(--novel-color-surface-elevated, #fff);
  border-radius: var(--novel-radius-sm, 6px);
  font-size: 13px;
  color: var(--novel-color-text, #2f3d34);
}

.is-muted {
  color: var(--novel-color-text-muted, #8a968e);
}
</style>
