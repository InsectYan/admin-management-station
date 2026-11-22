'use strict';

/** 工作流里一次成功落库对应一种数据。前端按这个名字刷新对应接口。 */
const DATA_KINDS = {
  script: 'script',
  storyboard: 'storyboard',
  profile: 'profile',
  asset: 'asset',
  prompt: 'prompt',
  workflow: 'workflow',
  video: 'video',
};

function isDataKind(kind) {
  return Object.prototype.hasOwnProperty.call(DATA_KINDS, kind);
}

module.exports = {
  DATA_KINDS,
  isDataKind,
};
