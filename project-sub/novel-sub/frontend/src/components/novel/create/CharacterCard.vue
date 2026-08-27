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
      <el-form-item label="性格">
        <el-input v-model="character.personality" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="背景">
        <el-input v-model="character.background" type="textarea" :rows="2" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="目标 / 动机">
        <el-input v-model="character.goal" type="textarea" :rows="2" @input="$emit('change')" />
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
    </el-form>
  </div>
</template>

<script setup>
import { CHARACTER_ROLE_OPTIONS } from '../../../utils/novelCreateSchema.js';

defineProps({
  character: { type: Object, required: true },
});

defineEmits(['change', 'remove']);
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
