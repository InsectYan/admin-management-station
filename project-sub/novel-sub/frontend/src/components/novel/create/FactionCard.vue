<template>
  <div class="novel-faction-card novel-parchment-card">
    <div class="novel-faction-card__header">
      <el-select
        v-model="faction.kind"
        size="small"
        style="width: 110px"
        @change="$emit('change')"
      >
        <el-option
          v-for="item in FACTION_KIND_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="faction.alignment"
        size="small"
        style="width: 90px"
        @change="$emit('change')"
      >
        <el-option
          v-for="item in FACTION_ALIGNMENT_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button link type="danger" @click="$emit('remove')">删除</el-button>
    </div>
    <el-form label-position="top" class="novel-magic-form__inner">
      <el-form-item label="名称">
        <el-input v-model="faction.name" placeholder="门派 / 家族 / 国家名称" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="驻地">
        <el-input v-model="faction.headquarters" placeholder="山门、都城或据点" @input="$emit('change')" />
      </el-form-item>
      <el-form-item label="简介">
        <el-input
          v-model="faction.description"
          type="textarea"
          :rows="3"
          placeholder="来历、立场、对外形象"
          @input="$emit('change')"
        />
      </el-form-item>
      <el-form-item label="规矩 / 戒律">
        <el-input
          v-model="faction.rules"
          type="textarea"
          :rows="2"
          placeholder="入门条件、禁忌、赏罚"
          @input="$emit('change')"
        />
      </el-form-item>
      <el-form-item v-if="characters.length" label="成员">
        <el-select
          v-model="faction.member_ids"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="关联已有角色"
          style="width: 100%"
          @change="$emit('change')"
        >
          <el-option
            v-for="row in characters"
            :key="row.id"
            :label="row.name || '未命名'"
            :value="row.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { FACTION_ALIGNMENT_OPTIONS, FACTION_KIND_OPTIONS } from '../../../utils/novelCreateSchema.js';

defineProps({
  faction: { type: Object, required: true },
  characters: { type: Array, default: () => [] },
});

defineEmits(['change', 'remove']);
</script>

<style scoped>
.novel-faction-card {
  padding: 16px;
}

.novel-faction-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.novel-faction-card__header .el-button {
  margin-left: auto;
}

.novel-parchment-card {
  background: var(--novel-color-parchment);
  border: var(--novel-border-gold);
  border-radius: var(--novel-radius-base);
  box-shadow: var(--novel-shadow-glow);
}
</style>
