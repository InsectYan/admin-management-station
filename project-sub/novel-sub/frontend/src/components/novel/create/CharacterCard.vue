<template>
  <div class="novel-character-card novel-parchment-card">
    <div class="novel-character-card__header">
      <el-select
        v-model="character.role"
        size="small"
        style="width: 100px"
        @change="$emit('change')"
      >
        <el-option
          v-for="r in CHARACTER_ROLE_OPTIONS"
          :key="r.value"
          :label="r.label"
          :value="r.value"
        />
      </el-select>
      <el-button link type="danger" @click="$emit('remove')">删除</el-button>
    </div>
    <el-form label-position="top" class="novel-magic-form__inner">
      <el-form-item label="姓名">
        <el-input v-model="character.name" placeholder="角色名称" @input="$emit('change')" />
      </el-form-item>
      <el-form-item v-if="factions.length" label="所属组织">
        <el-select
          v-model="character.faction_id"
          clearable
          placeholder="可选"
          style="width: 100%"
          @change="$emit('change')"
        >
          <el-option
            v-for="item in factions"
            :key="item.id"
            :label="item.name || '未命名组织'"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="年龄">
        <el-input v-model="character.age" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="身份">
        <el-input v-model="character.identity" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="外貌">
        <el-input v-model="character.appearance" type="textarea" :rows="2" placeholder="文字形象，图片放在视频资产里" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="语言风格">
        <el-input v-model="character.speech_style" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="性格">
        <el-input v-model="character.personality" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="背景">
        <el-input v-model="character.background" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="目标 / 动机">
        <el-input v-model="character.goal" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="人物弧光">
        <el-input v-model="character.arc" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="人物关系（文本）">
        <el-input
          v-model="character.relations"
          type="textarea"
          :rows="2"
          placeholder="与其他角色的关系说明"
          @input="$emit('change')"
        />
      </el-form-item>
      <el-form-item label="视频资产编号">
        <el-input v-model="character.video_asset_id" placeholder="对应视频项目里的资产编号" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="状态轨迹">
        <el-input
          :model-value="statesText"
          type="textarea"
          :rows="3"
          placeholder="一行一章：章节编号 说明"
          @input="onStates"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CHARACTER_ROLE_OPTIONS } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  character: { type: Object, required: true },
  factions: { type: Array, default: () => [] },
});

const emit = defineEmits(['change', 'remove']);
const statesText = computed(() => (props.character.states || [])
  .map(item => `${item.chapter_id || ''} ${item.note || ''}`.trim())
  .filter(Boolean)
  .join('\n'));

function onStates(value) {
  props.character.states = String(value || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s+/);
    return { chapter_id: parts.shift() || '', note: parts.join(' ') };
  });
  emit('change');
}
</script>

<style scoped>
.novel-character-card {
  padding: 16px;
}

.novel-character-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.novel-parchment-card {
  background: var(--novel-color-parchment);
  border: var(--novel-border-gold);
  border-radius: var(--novel-radius-base);
  box-shadow: var(--novel-shadow-glow);
}
</style>
