import { defineAsyncComponent } from 'vue';

/** 模板 code → Panel 组件 */
export const TEMPLATE_COMPONENTS = {
  'TPL-DET': defineAsyncComponent(() => import('@/components/config-templates/TplDetPanel.vue')),
  'TPL-BND': defineAsyncComponent(() => import('@/components/config-templates/TplBndPanel.vue')),
  'TPL-REP': defineAsyncComponent(() => import('@/components/config-templates/TplRepPanel.vue')),
  'TPL-SET': defineAsyncComponent(() => import('@/components/config-templates/TplSetPanel.vue')),
  'TPL-CHAIN': defineAsyncComponent(() => import('@/components/config-templates/TplChainPanel.vue')),
  'TPL-PAIR': defineAsyncComponent(() => import('@/components/config-templates/TplPairPanel.vue')),
  'TPL-NEG': defineAsyncComponent(() => import('@/components/config-templates/TplNegPanel.vue')),
  'TPL-OBS': defineAsyncComponent(() => import('@/components/config-templates/TplObsPanel.vue')),
  'TPL-LOAD': defineAsyncComponent(() => import('@/components/config-templates/TplLoadPanel.vue')),
  'TPL-MAN': defineAsyncComponent(() => import('@/components/config-templates/TplManPanel.vue')),
  'TPL-API-CTX': defineAsyncComponent(() => import('@/components/config-templates/TplApiCtxPanel.vue')),
};

export const PANEL_KEY_TO_TEMPLATE = {
  det: 'TPL-DET',
  bnd: 'TPL-BND',
  rep: 'TPL-REP',
  set: 'TPL-SET',
  chain: 'TPL-CHAIN',
  pair: 'TPL-PAIR',
  neg: 'TPL-NEG',
  obs: 'TPL-OBS',
  load: 'TPL-LOAD',
  man: 'TPL-MAN',
  'api-ctx': 'TPL-API-CTX',
};

export const MIXED_TS_MAJORS = new Set([ 'C1', 'C2', 'C3', 'C4' ]);

export const API_CTX_SCHEME = 'TS-05-API';
export const CHAIN_SCHEME = 'TS-05-CHAIN';
export const API_CTX_TEMPLATE = 'TPL-API-CTX';
export const DET_TEMPLATE = 'TPL-DET';

/** 不需要辅验证的配置模板（多模板共用一个验证选择器时维护此列表） */
export const TEMPLATES_WITHOUT_SECONDARY_VALIDATION = [ 'TPL-DET' ];

export const TEMPLATE_DISPLAY_NAMES = {
  'TPL-DET': '确定性单次',
  'TPL-BND': '边界矩阵',
  'TPL-REP': '重复抽样',
  'TPL-SET': '固定样本集',
  'TPL-CHAIN': '多步链路',
  'TPL-API-CTX': '前置链路+接口模板',
  'TPL-PAIR': '对照对比',
  'TPL-NEG': '对抗专项',
  'TPL-OBS': '可观测稽核',
  'TPL-LOAD': '压测容量',
  'TPL-MAN': '人工评审',
};

/** scheme → 默认模板 */
export const SCHEME_TO_TEMPLATE = {
  'TS-01-DET': 'TPL-DET',
  'TS-02-BND': 'TPL-BND',
  'TS-03-REP': 'TPL-REP',
  'TS-04-SET': 'TPL-SET',
  'TS-05-CHAIN': 'TPL-CHAIN',
  'TS-05-API': 'TPL-API-CTX',
  'TS-06-PAIR': 'TPL-PAIR',
  'TS-07-NEG': 'TPL-NEG',
  'TS-08-OBS': 'TPL-OBS',
  'TS-09-LOAD': 'TPL-LOAD',
  'TS-10-MAN': 'TPL-MAN',
};

export const SCHEME_TEMPLATE_ALTERNATIVES = {
  'TS-05-CHAIN': [ 'TPL-CHAIN', 'TPL-API-CTX' ],
  'TS-05-API': [ 'TPL-API-CTX', 'TPL-CHAIN' ],
};

export function resolveTemplateComponent(templateCode) {
  return TEMPLATE_COMPONENTS[templateCode] || TEMPLATE_COMPONENTS['TPL-DET'];
}

/** 混合 TS 未显式指定 template_code 且 scheme=TS-05-CHAIN 时默认 api_ctx 模板 */
export function resolveMixedEffectiveTemplate(item, switchMeta = {}) {
  if (switchMeta.effective_template_code) return switchMeta.effective_template_code;
  if (item?.template_code) return item.template_code;
  if (MIXED_TS_MAJORS.has(item?.category_major_id) && item?.scheme_primary_id === CHAIN_SCHEME) {
    return API_CTX_TEMPLATE;
  }
  if (item?.scheme_primary_id === API_CTX_SCHEME) return API_CTX_TEMPLATE;
  return item?.template_code || 'TPL-CHAIN';
}
