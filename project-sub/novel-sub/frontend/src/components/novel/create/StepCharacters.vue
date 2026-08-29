<template>
  <div class="novel-step-characters">
    <CharacterLibrary
      :characters="characters"
      :active-id="localActiveId"
      @add="$emit('add')"
      @select="selectCharacter"
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
  activeId: { type: String, default: '' },
});

const emit = defineEmits(['change', 'add', 'remove', 'update:edges', 'update:activeId']);

const localActiveId = ref(props.activeId || '');

const activeCharacter = computed(() => props.characters.find((c) => c.id === localActiveId.value));

function selectCharacter(id) {
  localActiveId.value = id;
  emit('update:activeId', id);
}

watch(
  () => props.activeId,
  (id) => {
    if (id && id !== localActiveId.value) localActiveId.value = id;
  },
);

watch(
  () => props.characters,
  (list) => {
    if (!list.length) {
      localActiveId.value = '';
      emit('update:activeId', '');
      return;
    }
    if (!list.some((c) => c.id === localActiveId.value)) {
      localActiveId.value = list[0].id;
      emit('update:activeId', localActiveId.value);
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
