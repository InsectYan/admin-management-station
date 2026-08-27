<template>
  <div class="novel-step-characters">
    <CharacterLibrary
      :characters="characters"
      :active-id="activeId"
      @add="$emit('add')"
      @select="activeId = $event"
    />
    <div class="novel-step-characters__editor">
      <CharacterCard
        v-if="activeCharacter"
        :character="activeCharacter"
        @change="$emit('change')"
        @remove="$emit('remove', activeCharacter.id)"
      />
      <el-empty v-else description="从左侧选择或添加角色" />

      <CharacterRelationGraph
        :characters="characters"
        :edges="edges"
        @update:edges="$emit('update:edges', $event)"
        @change="$emit('change')"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import CharacterLibrary from './CharacterLibrary.vue';
import CharacterCard from './CharacterCard.vue';
import CharacterRelationGraph from './CharacterRelationGraph.vue';

const props = defineProps({
  characters: { type: Array, required: true },
  edges: { type: Array, required: true },
});

defineEmits(['change', 'add', 'remove', 'update:edges']);

const activeId = ref('');

const activeCharacter = computed(() => props.characters.find((c) => c.id === activeId.value));

watch(
  () => props.characters,
  (list) => {
    if (!list.length) {
      activeId.value = '';
      return;
    }
    if (!list.some((c) => c.id === activeId.value)) {
      activeId.value = list[0].id;
    }
  },
  { immediate: true, deep: true },
);
</script>

<style scoped>
.novel-step-characters {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 768px) {
  .novel-step-characters {
    grid-template-columns: 1fr;
  }
}
</style>
