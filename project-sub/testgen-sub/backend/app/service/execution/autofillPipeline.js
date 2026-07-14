'use strict';

const path = require('path');
const {
  assessConfigCompleteness,
  buildAutofillBlockedEnvelope,
  throwAutofillBlocked,
} = require('../../lib/configCompletenessGate');

// Docker 镜像内无 agent-management-sub；规则降级使用仓库内嵌副本
const LOCAL_RULES = {
  classify: () => require('../../lib/autofillRules/classifyIntent'),
  resolve: () => require('../../lib/autofillRules/resolveFixed'),
  structure: () => require('../../lib/autofillRules/proposePatch'),
};

const PLUGINS_ROOT = process.env.AGENT_PLUGINS_DIR
  || path.resolve(__dirname, '../../../../../../../agent-management-sub/plugins');

function loadRuleFromPlugins(rel) {
  // eslint-disable-next-line import/no-dynamic-require
  return require(path.join(PLUGINS_ROOT, rel));
}

function loadClassifyRule() {
  try {
    return loadRuleFromPlugins('fitness-intent-classify-skill/lib/classifyIntent.js');
  } catch {
    return LOCAL_RULES.classify();
  }
}

function loadResolveRule() {
  try {
    return loadRuleFromPlugins('fitness-fixed-resolve-skill/lib/resolveFixed.js');
  } catch {
    return LOCAL_RULES.resolve();
  }
}

function loadStructureRule() {
  try {
    return loadRuleFromPlugins('fitness-config-structure-skill/lib/proposePatch.js');
  } catch {
    return LOCAL_RULES.structure();
  }
}

function deepMerge(a = {}, b = {}) {
  const out = { ...a };
  for (const [ k, v ] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)
      && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function pickOutput(res) {
  return res?.output || res?.data?.output || res?.data || {};
}

/**
 * BFF 编排 N1→N2→N3→(N4)。优先 Agent，失败则本机规则降级。
 */
class AutofillPipeline {
  /** @param {import('egg').Context} ctx */
  constructor(ctx) {
    this.ctx = ctx;
  }

  _envCatalog(env) {
    const auth = env?.auth_configured || {};
    return {
      has_bff_url: Boolean(env?.bff_coach_url),
      global_header_keys: Object.keys(auth.global_headers || {}),
      fixed_param_keys: Object.keys(auth.fixed_params || {}),
      has_authorization: Boolean(auth.global_headers?.Authorization),
    };
  }

  async _classify(item, baseConfig) {
    try {
      const r = await this.ctx.service.agentProxy.invokeFitnessIntentClassify({
        action: 'classify',
        item,
        config_json: baseConfig,
      });
      const out = pickOutput(r);
      if (out.intent && Array.isArray(out.fields)) {
        return { ...out, _source: 'agent' };
      }
    } catch (err) {
      this.ctx.logger.warn('[autofill] classify agent: %s', err.message);
      return {
        ...loadClassifyRule().classifyIntentRule({ item, config_json: baseConfig }),
        _source: 'rule',
        _agent_error: err.message,
      };
    }
    return {
      ...loadClassifyRule().classifyIntentRule({ item, config_json: baseConfig }),
      _source: 'rule',
    };
  }

  async _resolve(intentOut, catalogs) {
    try {
      const r = await this.ctx.service.agentProxy.invokeFitnessFixedResolve({
        action: 'resolve',
        fields: intentOut.fields || [],
        intent: intentOut.intent,
        env_catalog: catalogs.env_catalog,
        api_templates_catalog: catalogs.api_templates_catalog || [],
        project_vars: catalogs.project_vars || {},
      });
      const out = pickOutput(r);
      if (out.missing_fixed || out.resolved_fixed) {
        return { ...out, _source: 'agent' };
      }
    } catch (err) {
      this.ctx.logger.warn('[autofill] resolve agent: %s', err.message);
      return {
        ...loadResolveRule().resolveFixedRule({
          fields: intentOut.fields,
          intent: intentOut.intent,
          env_catalog: catalogs.env_catalog,
          api_templates_catalog: catalogs.api_templates_catalog,
          project_vars: catalogs.project_vars,
        }),
        _source: 'rule',
        _agent_error: err.message,
      };
    }
    return {
      ...loadResolveRule().resolveFixedRule({
        fields: intentOut.fields,
        intent: intentOut.intent,
        env_catalog: catalogs.env_catalog,
        api_templates_catalog: catalogs.api_templates_catalog,
        project_vars: catalogs.project_vars,
      }),
      _source: 'rule',
    };
  }

  async _structure(item, baseConfig, intentOut, fixedOut, gaps, catalogs) {
    try {
      const r = await this.ctx.service.agentProxy.invokeFitnessConfigStructure({
        action: 'propose_patch',
        item,
        config_json: baseConfig,
        intent: intentOut.intent,
        fields: intentOut.fields,
        fixed: fixedOut,
        gaps,
        api_templates_catalog: catalogs.api_templates_catalog || [],
      });
      const out = pickOutput(r);
      if (out.config_patch) {
        return { ...out, _source: 'agent' };
      }
    } catch (err) {
      this.ctx.logger.warn('[autofill] structure agent: %s', err.message);
      return {
        ...loadStructureRule().proposeConfigPatchRule({
          item,
          config_json: baseConfig,
          intent: intentOut.intent,
          fields: intentOut.fields,
          fixed: fixedOut,
          gaps,
          api_templates_catalog: catalogs.api_templates_catalog,
        }),
        _source: 'rule',
        _agent_error: err.message,
      };
    }
    return {
      ...loadStructureRule().proposeConfigPatchRule({
        item,
        config_json: baseConfig,
        intent: intentOut.intent,
        fields: intentOut.fields,
        fixed: fixedOut,
        gaps,
        api_templates_catalog: catalogs.api_templates_catalog,
      }),
      _source: 'rule',
    };
  }

  async _maybeSample(structureOut, item, patch) {
    if (!Array.isArray(structureOut.sample_needs) || !structureOut.sample_needs.length) {
      return patch;
    }
    try {
      const need = structureOut.sample_needs[0];
      const sampleRes = await this.ctx.service.agentProxy.invokeFitnessSample({
        action: 'from_example',
        item,
        example: need.schema_hint || { message: 'autofill-sample' },
        count: 1,
      });
      const out = pickOutput(sampleRes);
      const samples = out.samples || out.sample_items || [];
      const frag = samples[0]?.input_data || samples[0]?.body || samples[0];
      if (frag && typeof frag === 'object') {
        return deepMerge(patch, { body: { ...(patch.body || {}), ...frag } });
      }
    } catch (err) {
      this.ctx.logger.warn('[autofill] sample: %s', err.message);
    }
    return patch;
  }

  async _loadApiTemplates(projectCode) {
    try {
      const rows = await this.ctx.model.FtApiTemplate.findAll({
        where: { project_code: projectCode, is_active: true },
        limit: 100,
      });
      return rows.map(r => {
        const j = r.toJSON();
        const exportKeys = [];
        const schema = j.export_schema || {};
        if (Array.isArray(schema)) {
          for (const s of schema) exportKeys.push(s.key || s.name || s);
        } else if (typeof schema === 'object') {
          exportKeys.push(...Object.keys(schema));
        }
        return {
          id: j.id,
          name: j.name,
          template_code: j.template_code,
          export_keys: exportKeys,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * @param {object} args
   */
  async run(args) {
    const { item, env, runConfig, schemeId, persist_autofill: persist = false } = args;
    const env_catalog = this._envCatalog(env);
    const api_templates_catalog = await this._loadApiTemplates(item.project_code);
    const catalogs = { env_catalog, api_templates_catalog, project_vars: { keys: Object.keys(env_catalog.fixed_param_keys || {}) } };

    const assessment = assessConfigCompleteness(schemeId, item, runConfig, { env_catalog });
    if (assessment.complete || assessment.skipped) {
      return { skipped: true, reason: assessment.skipped ? 'scheme_not_covered' : 'already_complete', assessment, runConfig };
    }

    const requireAgent = Boolean(this.ctx.app.config.agentPlatform?.autofillRequireAgent);
    const agentProbe = await this.ctx.service.agentProxy.probeAutofillSkills();
    if (requireAgent && !agentProbe.ok) {
      throwAutofillBlocked(buildAutofillBlockedEnvelope({
        item,
        env,
        assessment: {
          ...assessment,
          gaps: [{
            field: 'autofill_pipeline',
            role: 'fixed',
            reason: agentProbe.error
              ? `执行期补齐需要 Agent，但平台不可达（${agentProbe.baseUrl}）：${agentProbe.error}`
              : `执行期补齐需要 Agent，但未加载 Skill：${(agentProbe.missing || []).join(', ')}。请启动 agentm 并确认 master/plugins 已 junction N1/N2/N3`,
          }],
        },
        pipeline_step: 'agent_probe',
      }));
    }
    if (!agentProbe.ok) {
      this.ctx.logger.warn(
        '[autofill] Agent N1/N2/N3 不可用，将降级本地规则：%s missing=%j',
        agentProbe.error || 'ok-ish',
        agentProbe.missing,
      );
    }

    const baseConfig = runConfig?.config_json || {};
    const intentOut = await this._classify(item, baseConfig);
    const fixedOut = await this._resolve(intentOut, catalogs);

    if (Array.isArray(fixedOut.missing_fixed) && fixedOut.missing_fixed.length) {
      const { configFieldLabel } = require('../../lib/configFieldLabels');
      throwAutofillBlocked(buildAutofillBlockedEnvelope({
        item,
        env,
        assessment: {
          ...assessment,
          gaps: [
            ...fixedOut.missing_fixed.map(m => ({
              field: m.field,
              role: 'fixed',
              reason: m.detail,
              expected_source: m.expected_source,
              label: configFieldLabel(m.field),
            })),
          ],
        },
        intent: intentOut.intent,
        filled: fixedOut.resolved_fixed || [],
        pipeline_step: 'resolve',
      }));
    }

    const structureOut = await this._structure(
      item, baseConfig, intentOut, fixedOut, assessment.gaps, catalogs,
    );
    let patch = structureOut.config_patch || {};
    patch = await this._maybeSample(structureOut, item, patch);

    const stepSources = {
      classify: intentOut._source || 'rule',
      resolve: fixedOut._source || 'rule',
      structure: structureOut._source || 'rule',
    };

    const mergedConfigJson = deepMerge(baseConfig, patch);
    mergedConfigJson.autofill_meta = {
      ...(patch.autofill_meta || {}),
      filled_at: new Date().toISOString(),
      intent: intentOut.intent,
      persist: Boolean(persist),
      pipeline: [ 'classify', 'resolve', 'structure' ],
      step_sources: stepSources,
      agent_probe: {
        ok: agentProbe.ok,
        base_url: agentProbe.baseUrl,
        missing: agentProbe.missing || [],
        error: agentProbe.error || null,
      },
      note: agentProbe.ok
        ? undefined
        : 'Agent N1/N2/N3 不可达，已用本地规则降级；意图/鉴权边界类用例建议启动 Agent 平台',
    };

    let saved = runConfig;
    if (runConfig?.id) {
      await runConfig.update({ config_json: mergedConfigJson });
      saved = await runConfig.reload();
    } else if (item?.item_id && schemeId) {
      const [ row ] = await this.ctx.model.FtRunConfig.findOrCreate({
        where: { item_id: item.item_id, scheme_id: schemeId },
        defaults: { config_json: mergedConfigJson, threshold_json: {} },
      });
      await row.update({ config_json: mergedConfigJson });
      saved = row;
    }

    return {
      skipped: false,
      intent: intentOut.intent,
      fixed: fixedOut,
      config_patch: patch,
      runConfig: saved,
      assessment,
      step_sources: stepSources,
      agent_probe: agentProbe,
    };
  }
}

module.exports = AutofillPipeline;
