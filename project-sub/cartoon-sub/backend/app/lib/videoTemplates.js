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
  {
    id: 'brand_line',
    name: '品牌口号',
    content_type: 'ai_brand',
    content_label: '品牌',
    stage: 'script',
    stage_label: '脚本',
    industry: 'brand',
    industry_label: '品牌',
    scene: '用一句口号和合规句做品牌片，不新建叙事作品',
    needs_package: false,
    voice_label: '旁白',
    subtitle_label: '底部字幕',
    pending: [],
    copy_blocks: [
      { sort_order: 1, title: '口号', body: '先写品牌主张，再写一句合规说明。' },
    ],
    shots: [ { description: '片头露出品牌标识' } ],
  },
  {
    id: 'documentary_narration',
    name: '纪录片旁白',
    content_type: 'ai_documentary',
    content_label: '纪录片',
    stage: 'script',
    stage_label: '脚本',
    industry: 'story',
    industry_label: '故事',
    scene: '旁白和史料来自已发布的故事包',
    needs_package: true,
    voice_label: '旁白',
    subtitle_label: '底部字幕',
    pending: [],
    copy_blocks: [],
    shots: [ { description: '史料画面配旁白' } ],
  },
  {
    id: 'music_lyric',
    name: '音乐歌词',
    content_type: 'ai_music',
    content_label: '音乐 MV',
    stage: 'script',
    stage_label: '脚本',
    industry: 'music',
    industry_label: '音乐',
    scene: '歌词时间轴写在视频项目里，故事包可以不绑',
    needs_package: false,
    voice_label: '原唱',
    subtitle_label: '歌词字幕',
    pending: [],
    copy_blocks: [],
    shots: [ { description: '歌词与节拍对齐的画面' } ],
  },
  {
    id: 'children_story',
    name: '儿童故事',
    content_type: 'ai_children',
    content_label: '儿童',
    stage: 'script',
    stage_label: '脚本',
    industry: 'education',
    industry_label: '教育',
    scene: '故事脚本来自叙事台，画面使用全年龄分级',
    needs_package: true,
    voice_label: '旁白',
    subtitle_label: '底部字幕',
    pending: [],
    copy_blocks: [],
    shots: [ { description: '慢语速讲完一个情节' } ],
  },
  {
    id: 'language_card',
    name: '语言发音卡',
    content_type: 'ai_language',
    content_label: '语言学习',
    stage: 'script',
    stage_label: '脚本',
    industry: 'education',
    industry_label: '教育',
    scene: '情景剧脚本来自叙事台，字幕至少两种语言',
    needs_package: true,
    voice_label: '发音',
    subtitle_label: '多语字幕',
    pending: [],
    copy_blocks: [],
    shots: [ { description: '一句对白配一张发音卡' } ],
  },
  {
    id: 'news_timeline',
    name: '新闻时间线',
    content_type: 'ai_news',
    content_label: '新闻',
    stage: 'script',
    stage_label: '脚本',
    industry: 'news',
    industry_label: '新闻',
    scene: '时间线和事实来源写在视频项目里',
    needs_package: false,
    voice_label: '口播',
    subtitle_label: '底部字幕',
    pending: [],
    copy_blocks: [
      { sort_order: 1, title: '事件', body: '先写时间，再写事实来源。' },
    ],
    shots: [ { description: '一条时间线配口播' } ],
  },
  {
    id: 'travel_spot',
    name: '旅游景点',
    content_type: 'ai_travel',
    content_label: '旅游',
    stage: 'script',
    stage_label: '脚本',
    industry: 'travel',
    industry_label: '旅游',
    scene: '景点卡写在视频项目里，不新建叙事作品',
    needs_package: false,
    voice_label: '讲解',
    subtitle_label: '底部字幕',
    pending: [],
    copy_blocks: [
      { sort_order: 1, title: '景点', body: '写这个地方可以看什么。' },
    ],
    shots: [ { description: '景点画面配讲解' } ],
  },
  {
    id: 'fitness_step',
    name: '健身动作',
    content_type: 'ai_fitness',
    content_label: '健身',
    stage: 'script',
    stage_label: '脚本',
    industry: 'fitness',
    industry_label: '健身',
    scene: '动作步骤写在视频项目里',
    needs_package: false,
    voice_label: '口令',
    subtitle_label: '底部字幕',
    pending: [],
    copy_blocks: [
      { sort_order: 1, title: '动作', body: '写步骤和口令。' },
    ],
    shots: [ { description: '一个动作的示范' } ],
  },
  {
    id: 'sleep_guide',
    name: '助眠引导',
    content_type: 'ai_sleep',
    content_label: '助眠',
    stage: 'script',
    stage_label: '脚本',
    industry: 'sleep',
    industry_label: '助眠',
    scene: '呼吸引导写在视频项目里',
    needs_package: false,
    voice_label: '轻声',
    subtitle_label: '无字幕',
    pending: [],
    copy_blocks: [
      { sort_order: 1, title: '引导', body: '写一段可以循环的呼吸引导。' },
    ],
    shots: [ { description: '缓慢的呼吸画面' } ],
  },
  {
    id: 'game_style',
    name: '游戏风格',
    content_type: 'ai_game',
    content_label: '游戏二创',
    stage: 'storyboard',
    stage_label: '分镜',
    industry: 'story',
    industry_label: '故事',
    scene: '角色档案来自已有世界观，需要绑定故事包',
    needs_package: true,
    voice_label: '对白',
    subtitle_label: '对白字幕',
    pending: [],
    copy_blocks: [],
    shots: [ { description: '按角色档案还原一个镜头' } ],
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
