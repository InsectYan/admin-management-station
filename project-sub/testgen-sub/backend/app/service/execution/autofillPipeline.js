'use strict';

const path = require('path');
const {
  assessConfigCompleteness,
  buildAutofillBlockedEnvelope,
  throwAutofillBlocked,
} = require('../../lib/configCompletenessGate');

const PLUGINS_ROOT = process.env.AGENT_PLUGINS_DIR
  || path.resolve(__dirname, '../../../../../../../agent-management-sub/plugins');

function loadRule(rel) {
  // eslint-disable-next-line import/no-dynamic-require
  return require(path.join(PLUGINS_ROOT, rel));
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
      if (out.intent && Array.isArray(out.fields)) return out;
    } catch (err) {
      this.ctx.logger.warn('[autofill] classify agent: %s', err.message);
    }
    return loadRule('fitness-intent-classify-skill/lib/classifyIntent.js')
      .classifyIntentRule({ item, config_json: baseConfig });
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
      if (out.missing_fixed || out.resolved_fixed) return out;
    } catch (err) {
      this.ctx.logger.warn('[autofill] resolve agent: %s', err.message);
    }
    return loadRule('fitness-fixed-resolve-skill/lib/resolveFixed.js').resolveFixedRule({
      fields: intentOut.fields,
      intent: intentOut.intent,
      env_catalog: catalogs.env_catalog,
      api_templates_catalog: catalogs.api_templates_catalog,
      project_vars: catalogs.project_vars,
    });
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
      if (out.config_patch) return out;
    } catch (err) {
      this.ctx.logger.warn('[autofill] structure agent: %s', err.message);
    }
    return loadRule('fitness-config-structure-skill/lib/proposePatch.js').proposeConfigPatchRule({
      item,
      config_json: baseConfig,
      intent: intentOut.intent,
      fields: intentOut.fields,
      fixed: fixedOut,
      gaps,
      api_templates_catalog: catalogs.api_templates_catalog,
    });
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

    const baseConfig = runConfig?.config_json || {};
    const intentOut = await this._classify(item, baseConfig);
    const fixedOut = await this._resolve(intentOut, catalogs);

    if (Array.isArray(fixedOut.missing_fixed) && fixedOut.missing_fixed.length) {
      throwAutofillBlocked(buildAutofillBlockedEnvelope({
        item,
        env,
        assessment: {
          ...assessment,
          gaps: [
            ...(assessment.gaps || []),
            ...fixedOut.missing_fixed.map(m => ({
              field: m.field,
              role: 'fixed',
              reason: m.detail,
              expected_source: m.expected_source,
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

    const mergedConfigJson = deepMerge(baseConfig, patch);
    mergedConfigJson.autofill_meta = {
      ...(patch.autofill_meta || {}),
      filled_at: new Date().toISOString(),
      intent: intentOut.intent,
      persist: Boolean(persist),
      pipeline: [ 'classify', 'resolve', 'structure' ],
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
    };
  }
}

module.exports = AutofillPipeline;
