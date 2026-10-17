<template>
  <div v-if="visible" class="precheck-supply">
    <p class="precheck-supply__note">{{ supplies.note }}</p>

    <section v-if="supplies.plugins.length">
      <h4 class="precheck-supply__heading">缺少的插件</h4>
      <div v-for="plugin in supplies.plugins" :key="plugin.id" class="precheck-supply__row">
        <div class="precheck-supply__label">
          {{ plugin.label }}
          <span>节点：{{ plugin.missing_nodes.join('、') }}</span>
        </div>
        <el-select v-model="pluginPicks[plugin.id]" placeholder="选择来源" filterable @change="summaryText = ''">
          <el-option v-for="option in plugin.options" :key="option.id" :label="option.label" :value="option.id" />
        </el-select>
        <a v-if="pickedPlugin(plugin)" class="precheck-supply__link" :href="pickedPlugin(plugin).url" target="_blank" rel="noreferrer">打开页面</a>
      </div>
    </section>

    <section v-for="family in supplies.families" :key="family.id">
      <h4 class="precheck-supply__heading">{{ family.label }}</h4>
      <div v-for="slot in family.slots" :key="slot.id" class="precheck-supply__row">
        <div class="precheck-supply__label">
          {{ slot.label }}
          <span v-if="slot.asked">工作流里写的是 {{ slot.asked }}</span>
          <span v-else>配套项，会随已选精度过滤</span>
          <span v-if="slot.present_name && !slot.missing">目录里已有 {{ fileName(slot.present_name) }}</span>
        </div>
        <el-select
          v-model="slotPicks[pickKey(family, slot)]"
          placeholder="选择模型和来源"
          filterable
          @change="onSlotChange(family, slot)"
        >
          <el-option
            v-for="option in visibleOptions(family, slot)"
            :key="option.id"
            :label="`${option.label} · ${option.name}`"
            :value="option.id"
          />
        </el-select>
        <a
          v-if="pickedSlot(family, slot)"
          class="precheck-supply__link"
          :href="pickedSlot(family, slot).url"
          target="_blank"
          rel="noreferrer"
        >打开页面</a>
      </div>
    </section>

    <section v-if="supplies.loose.length">
      <h4 class="precheck-supply__heading">未收录的模型</h4>
      <div v-for="item in supplies.loose" :key="item.id" class="precheck-supply__row">
        <div class="precheck-supply__label">
          {{ item.asked }}
          <span>按文件名到网站上核对后再下载</span>
        </div>
        <el-select v-model="slotPicks[item.id]" placeholder="选择搜索网站" filterable @change="summaryText = ''">
          <el-option v-for="option in item.options" :key="option.id" :label="option.label" :value="option.id" />
        </el-select>
        <a v-if="pickedLoose(item)" class="precheck-supply__link" :href="pickedLoose(item).url" target="_blank" rel="noreferrer">打开页面</a>
      </div>
    </section>

    <div class="precheck-supply__actions">
      <el-button type="primary" :disabled="!ready" @click="summarize">梳理</el-button>
      <el-button v-if="summaryText" @click="copySummary">复制</el-button>
    </div>
    <el-input v-if="summaryText" :model-value="summaryText" type="textarea" :rows="12" readonly />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  supplies: { type: Object, default: () => ({ plugins: [], families: [], loose: [] }) },
});

const pluginPicks = reactive({});
const slotPicks = reactive({});
const summaryText = ref('');

const visible = computed(() => {
  const data = props.supplies || {};
  return Boolean((data.plugins || []).length || (data.families || []).length || (data.loose || []).length);
});

watch(() => props.supplies, (data) => {
  Object.keys(pluginPicks).forEach(key => delete pluginPicks[key]);
  Object.keys(slotPicks).forEach(key => delete slotPicks[key]);
  summaryText.value = '';
  if (!data) return;
  (data.plugins || []).forEach(plugin => {
    if (plugin.options.length === 1) pluginPicks[plugin.id] = plugin.options[0].id;
  });
  (data.families || []).forEach(family => {
    family.slots.forEach(slot => {
      const asked = prefer(slot.options, slot.asked);
      if (asked) slotPicks[pickKey(family, slot)] = asked.id;
    });
    const locks = lockedGroups(family);
    family.slots.forEach(slot => {
      const key = pickKey(family, slot);
      if (slotPicks[key]) return;
      const present = prefer(visibleOptions(family, slot, locks), slot.present_name);
      if (present) slotPicks[key] = present.id;
    });
    reconcile(family);
  });
}, { immediate: true });

function reconcile(family) {
  const locks = lockedGroups(family);
  family.slots.forEach(slot => {
    const key = pickKey(family, slot);
    if (!slotPicks[key]) return;
    const allowed = visibleOptions(family, slot, locks).some(option => option.id === slotPicks[key]);
    if (!allowed) delete slotPicks[key];
  });
}

function onSlotChange(family, slot) {
  const option = slot.options.find(item => item.id === slotPicks[pickKey(family, slot)]);
  const group = variantGroup(option?.variant);
  if (group) {
    family.slots.forEach(other => {
      if (other.id === slot.id) return;
      const current = other.options.find(item => item.id === slotPicks[pickKey(family, other)]);
      const currentGroup = variantGroup(current?.variant);
      if (currentGroup === group && current.variant !== option.variant) delete slotPicks[pickKey(family, other)];
    });
  }
  summaryText.value = '';
}

const ready = computed(() => {
  const data = props.supplies || {};
  const pluginsReady = (data.plugins || []).every(plugin => pluginPicks[plugin.id]);
  const slotsReady = (data.families || []).every(family => family.slots.every(slot => {
    const key = pickKey(family, slot);
    return visibleOptions(family, slot).some(option => option.id === slotPicks[key]);
  }));
  const looseReady = (data.loose || []).every(item => slotPicks[item.id]);
  return pluginsReady && slotsReady && looseReady;
});

function fileName(file) {
  return String(file || '').split(/[/\\]/).pop();
}

function variantGroup(variant) {
  if (!variant) return '';
  if (variant === '4steps' || variant === '8steps') return 'steps';
  if (variant === '2512') return 'generation';
  return 'precision';
}

function pickKey(family, slot) {
  return `${family.id}:${slot.id}`;
}

function prefer(options, filename) {
  const base = fileName(filename);
  if (!base) return null;
  const hits = (options || []).filter(option => option.name === base);
  return hits.find(option => option.site === 'Hugging Face') || hits[0] || null;
}

function lockedGroups(family, picks = slotPicks) {
  const locks = {};
  family.slots.forEach(slot => {
    const option = slot.options.find(item => item.id === picks[pickKey(family, slot)]);
    const group = variantGroup(option?.variant);
    if (group && !locks[group]) locks[group] = option.variant;
  });
  return locks;
}

function visibleOptions(family, slot, locks = lockedGroups(family)) {
  return slot.options.filter(option => {
    const group = variantGroup(option.variant);
    if (!group || !locks[group]) return true;
    return locks[group] === option.variant;
  });
}

function pickedPlugin(plugin) {
  return plugin.options.find(option => option.id === pluginPicks[plugin.id]) || null;
}

function pickedSlot(family, slot) {
  return slot.options.find(option => option.id === slotPicks[pickKey(family, slot)]) || null;
}

function pickedLoose(item) {
  return item.options.find(option => option.id === slotPicks[item.id]) || null;
}

function summarize() {
  const lines = [];
  (props.supplies.plugins || []).forEach(plugin => {
    const option = pickedPlugin(plugin);
    if (!option) return;
    lines.push([
      '插件',
      option.name,
      `节点：${plugin.missing_nodes.join('、')}`,
      `目录：${option.place}`,
      `页面：${option.url}`,
    ].join('\n'));
  });
  (props.supplies.families || []).forEach(family => {
    family.slots.forEach(slot => {
      const option = pickedSlot(family, slot);
      if (!option) return;
      const already = fileName(slot.present_name) === option.name;
      lines.push([
        already ? '模型（已在目录）' : '模型',
        option.name,
        `配套：${family.label} / ${slot.label}`,
        slot.asked && slot.asked !== option.name ? `工作流原文件名：${slot.asked}` : '',
        `目录：${option.place}`,
        already ? '' : `页面：${option.url}`,
      ].filter(Boolean).join('\n'));
    });
  });
  (props.supplies.loose || []).forEach(item => {
    const option = pickedLoose(item);
    if (!option) return;
    lines.push([
      '模型',
      option.name,
      `目录：${option.place}`,
      `页面：${option.url}`,
    ].join('\n'));
  });
  if ((props.supplies.plugins || []).length) {
    lines.push('自定义节点放进目录后，当前 ComfyUI 启动参数 --disable-all-custom-nodes 仍不会加载它们。');
  }
  summaryText.value = lines.join('\n\n');
}

async function copySummary() {
  await navigator.clipboard.writeText(summaryText.value);
  ElMessage.success('已复制');
}
</script>

<style scoped>
.precheck-supply__note { margin: 0 0 12px; color: #3d5c49; }
.precheck-supply__heading { margin: 16px 0 8px; font-size: 14px; color: #1f3d2c; }
.precheck-supply__row { display: grid; grid-template-columns: minmax(180px, 280px) minmax(220px, 1fr) auto; gap: 8px 12px; align-items: center; margin-bottom: 10px; }
.precheck-supply__label { display: flex; flex-direction: column; gap: 2px; }
.precheck-supply__label span { color: #5d7366; font-size: 12px; }
.precheck-supply__link { color: #2f8a5b; }
.precheck-supply__actions { display: flex; gap: 8px; margin: 12px 0; }
</style>
