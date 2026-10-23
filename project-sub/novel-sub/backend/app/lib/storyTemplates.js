'use strict';

const ROLES = [
  { value: 'main', label: '主角' },
  { value: 'support', label: '配角' },
  { value: 'villain', label: '反派' },
];

const TEMPLATES = [
  { id: 'web_serial', name: '网文连载', project_kind: 'novel', volume_title: '第一卷' },
  { id: 'short_drama', name: '短剧', project_kind: 'short_drama', volume_title: '第一季' },
  { id: 'comic_script', name: '漫剧剧本', project_kind: 'comic_script', volume_title: '第一部' },
  { id: 'game_plot', name: '游戏剧情', project_kind: 'game_plot', volume_title: '主线' },
];

function listStoryTemplates() {
  return TEMPLATES.map(item => ({
    id: item.id,
    name: item.name,
    project_kind: item.project_kind,
    volume_title: item.volume_title,
    character_roles: ROLES.map(role => ({ ...role })),
  }));
}

function storyTemplateDraft(templateId, title) {
  const template = TEMPLATES.find(item => item.id === templateId);
  if (!template) {
    const err = new Error('模板不存在');
    err.status = 400;
    throw err;
  }
  const name = String(title || '').trim();
  if (!name) {
    const err = new Error('标题不能为空');
    err.status = 400;
    throw err;
  }
  return {
    title: name,
    project_kind: template.project_kind,
    status: 'draft',
    setting_json: {
      outline: {
        volumes: [{
          id: 'vol_1',
          title: template.volume_title,
          word_target: 0,
          groups: [{
            id: 'grp_1',
            title: '开篇',
            word_target: 0,
            sections: [{ id: 'sec_1', title: '起', word_target: 0 }],
          }],
        }],
      },
      characters: [],
      character_roles: ROLES.map(role => ({ ...role })),
    },
  };
}

module.exports = {
  listStoryTemplates,
  storyTemplateDraft,
};
