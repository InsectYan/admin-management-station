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
};

export const MIXED_TS_MAJORS = new Set([ 'C1', 'C2', 'C3', 'C4' ]);

export function resolveTemplateComponent(templateCode) {
  return TEMPLATE_COMPONENTS[templateCode] || TEMPLATE_COMPONENTS['TPL-DET'];
}
