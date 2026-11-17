'use strict';

const SEXUAL_ACT = /性爱|性交|交合|交媾|做爱|云雨|交欢|抽送|抽插|插入|挺入|顶入/;

function describesSexualAct(shot) {
  const source = [ shot?.description, shot?.dialogue ].map(item => String(item || '')).join('\n');
  return SEXUAL_ACT.test(source);
}

function sexualDecision(row, content) {
  if (row?.sexual_source === 'manual') {
    return { sexual: row.sexual_act === true, source: 'manual' };
  }
  return { sexual: describesSexualAct(content), source: 'machine' };
}

function machineSexualFields(project, content) {
  if (!project?.av_mode) return {};
  const decision = sexualDecision(null, content);
  return { sexual_act: decision.sexual, sexual_source: 'machine' };
}

module.exports = { describesSexualAct, sexualDecision, machineSexualFields };
