'use strict';

const TEMPLATES = [
  {
    id: 'science_point',
    name: '科普知识点',
    content_type: 'ai_science',
    content_label: '科普',
    stage: 'script',
    stage_label: '脚本',
    industry: 'education',
    industry_label: '教育',
    scene: '用一条知识点讲清一个概念',
    needs_package: false,
    voice_label: '旁白',
    subtitle_label: '底部字幕',
    pending: [ '旁白' ],
    copy_blocks: [
      { sort_order: 1, title: '知识点', body: '先写这个概念是什么，再写一个日常例子。' },
    ],
    shots: [
      { description: '用一个画面解释这个知识点' },
    ],
  },
  {
    id: 'comic_opening',
    name: '漫剧开篇',
    content_type: 'ai_comic',
    content_label: '漫剧',
    stage: 'storyboard',
    stage_label: '分镜',
    industry: 'story',
    industry_label: '故事',
    scene: '先建项目，再绑定已发布的故事包',
    needs_package: true,
    voice_label: '对白',
    subtitle_label: '对白字幕',
    pending: [ '旁白' ],
    copy_blocks: [],
    shots: [
      { description: '开场：交代人物和地点' },
      { description: '冲突：出现要解决的事' },
    ],
  },
];

function present(item) {
  return {
    id: item.id,
    name: item.name,
    content_type: item.content_type,
    content_label: item.content_label,
    stage: item.stage,
    stage_label: item.stage_label,
    industry: item.industry,
    industry_label: item.industry_label,
    scene: item.scene,
    needs_package: item.needs_package,
    voice_label: item.voice_label,
    subtitle_label: item.subtitle_label,
    pending: item.pending.slice(),
    copy_blocks: item.copy_blocks.map(block => ({ ...block })),
    shots: item.shots.map(shot => ({ description: shot.description })),
  };
}

function listVideoTemplates(query = {}) {
  return TEMPLATES.filter(item => {
    if (query.content_type && item.content_type !== query.content_type) return false;
    if (query.stage && item.stage !== query.stage) return false;
    if (query.industry && item.industry !== query.industry) return false;
    return true;
  }).map(present);
}

function videoTemplateDraft(templateId) {
  const template = TEMPLATES.find(item => item.id === templateId);
  if (!template) {
    const err = new Error('模板不存在');
    err.status = 400;
    throw err;
  }
  return present(template);
}

function templateGaps(templateId, project, assets) {
  const template = TEMPLATES.find(item => item.id === templateId);
  if (!template) return [];
  const gaps = [];
  if (template.needs_package && !project.package_version) gaps.push('故事包');
  const names = new Set((assets || []).map(item => item.name));
  for (const name of template.pending) {
    if (!names.has(name)) gaps.push(name);
  }
  return gaps;
}

module.exports = {
  listVideoTemplates,
  videoTemplateDraft,
  templateGaps,
};
