'use strict';

const CATALOGS = [
  {
    key: 'visual_style',
    name: '画面风格',
    description: '项目画风。生成提示词时会带上名称和说明，含仍被旧项目使用的兼容项。',
    fields: [
      { key: 'code', label: '编码', required: true },
      { key: 'name', label: '名称', required: true },
      { key: 'group_name', label: '分组' },
      { key: 'note', label: '说明', type: 'textarea' },
      { key: 'prompt', label: '提示词', type: 'textarea' },
    ],
  },
  {
    key: 'style_class',
    name: '风格类',
    description: '叠在画面风格上的渲染滤镜。每一组是一个下拉框，组里是可选项。Midjourney 是第一组，以后新增一组就会多一个下拉框。',
    fields: [
      { key: 'code', label: '编码', required: true },
      { key: 'name', label: '名称', required: true },
      { key: 'group_name', label: '风格类', required: true },
      { key: 'note', label: '说明', type: 'textarea' },
      { key: 'prompt', label: '提示词', type: 'textarea' },
    ],
  },
  {
    key: 'shot_size',
    name: '景别',
    description: '分镜主景别。一个镜头可以选多个，存的是这里的名称。',
    fields: [
      { key: 'name', label: '名称', required: true },
    ],
  },
  {
    key: 'camera_move',
    name: '运镜',
    description: '分镜运镜。一个镜头可以选多个，存的是这里的名称。',
    fields: [
      { key: 'name', label: '名称', required: true },
    ],
  },
  {
    key: 'topic',
    name: '题材',
    description: '漫剧和短剧可以选的专题。改编码后，项目里已经选中的专题会一起改。编码 av 对应 AV 开关。',
    fields: [
      { key: 'code', label: '编码', required: true },
      { key: 'name', label: '名称', required: true },
    ],
  },
  {
    key: 'content_type',
    name: '内容类型',
    description: '新建项目时的类型。绑定方式决定要不要选小说。漫剧和短剧的编码别改，专题入口认的是这两个编码。',
    fields: [
      { key: 'code', label: '编码', required: true },
      { key: 'name', label: '名称', required: true },
      {
        key: 'bind',
        label: '绑定方式',
        type: 'select',
        options: [
          { value: 'required', label: '必须绑定小说' },
          { value: 'optional', label: '小说可选' },
          { value: 'local', label: '本地文案' },
        ],
      },
    ],
  },
];

function catalogOf(key) {
  return CATALOGS.find(item => item.key === String(key || '')) || null;
}

module.exports = {
  CATALOGS,
  catalogOf,
};
