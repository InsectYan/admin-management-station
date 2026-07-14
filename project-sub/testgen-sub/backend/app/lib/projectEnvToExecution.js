'use strict';

/**
 * 将项目页「环境模板」project_env_template 映射并同步到执行层 ft_execution_env（X-03）。
 * Launch / Orchestrator 只读 ft_execution_env；用户在项目环境页配置后须落到本表。
 */

const SYNC_MARKER = 'project_env_template';

/**
 * @param {Record<string, unknown>} tpl
 * @returns {string}
 */
function resolveBffBaseUrl(tpl) {
  return String(tpl.base_url || '').trim().replace(/\/$/, '');
}

/**
 * @param {Record<string, unknown>} tpl
 * @returns {Record<string, string>}
 */
function buildGlobalHeaders(tpl) {
  const headers = {};
  const secret = tpl.auth_secret;
  const authType = tpl.auth_type || 'none';
  if (!secret || authType === 'none') return headers;
  if (authType === 'bearer') {
    headers.Authorization = `Bearer ${secret}`;
  } else if (authType === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(String(secret)).toString('base64')}`;
  } else if (authType === 'apikey') {
    headers['X-API-Key'] = String(secret);
  }
  return headers;
}

/**
 * @param {Record<string, unknown>} tpl
 * @returns {string|null}
 */
function buildDatabaseUrl(tpl) {
  const host = String(tpl.db_host || '').trim();
  if (!host) return null;
  const port = String(tpl.db_port || '5432').trim() || '5432';
  const user = encodeURIComponent(String(tpl.db_user || 'postgres'));
  const pass = encodeURIComponent(String(tpl.db_password || ''));
  const db = encodeURIComponent(String(tpl.db_name || 'postgres'));
  const auth = tpl.db_password != null && String(tpl.db_password) !== ''
    ? `${user}:${pass}`
    : user;
  return `postgresql://${auth}@${host}:${port}/${db}`;
}

/**
 * @param {Record<string, unknown>} tpl
 * @param {{ isDefault?: boolean }} [opts]
 */
function mapTemplateToExecutionFields(tpl, opts = {}) {
  const bff = resolveBffBaseUrl(tpl);
  const authConfigured = {
    sync_source: SYNC_MARKER,
    template_id: tpl.id != null ? Number(tpl.id) : undefined,
    base_path: tpl.base_path || '/',
    tier: tpl.tier || 'staging',
    global_headers: buildGlobalHeaders(tpl),
  };
  const databaseUrl = buildDatabaseUrl(tpl);
  if (databaseUrl) authConfigured.database_url = databaseUrl;

  return {
    project_code: String(tpl.project_code || '').trim(),
    name: String(tpl.name || '').trim(),
    config_env_id: String(tpl.tier || 'staging').toUpperCase(),
    bff_coach_url: bff || null,
    bff_member_url: bff || null,
    bff_manager_url: bff || null,
    agent_chat_url: bff || null,
    auth_configured: authConfigured,
    is_default: Boolean(opts.isDefault),
  };
}

/**
 * @param {import('egg').Context} ctx
 * @param {Record<string, unknown>} tpl
 * @param {{ preferDefault?: boolean }} [opts]
 */
async function upsertExecutionEnvFromTemplate(ctx, tpl, opts = {}) {
  const preferDefault = Boolean(opts.preferDefault);
  const fields = mapTemplateToExecutionFields(tpl, { isDefault: preferDefault });
  if (!fields.project_code || !fields.name) return null;

  const existing = await ctx.model.FtExecutionEnv.findOne({
    where: { project_code: fields.project_code, name: fields.name },
  });

  const prevAuth = existing?.auth_configured && typeof existing.auth_configured === 'object'
    ? existing.auth_configured
    : {};
  const mergedAuth = {
    ...prevAuth,
    ...fields.auth_configured,
    fixed_params: prevAuth.fixed_params || {},
    global_headers: {
      ...(prevAuth.global_headers || {}),
      ...(fields.auth_configured.global_headers || {}),
    },
  };

  if (existing) {
    const patch = {
      config_env_id: fields.config_env_id,
      bff_coach_url: fields.bff_coach_url,
      bff_member_url: fields.bff_member_url,
      bff_manager_url: fields.bff_manager_url,
      agent_chat_url: fields.agent_chat_url,
      auth_configured: mergedAuth,
    };
    if (preferDefault && !existing.is_default) {
      await ctx.model.FtExecutionEnv.update(
        { is_default: false },
        { where: { project_code: fields.project_code, is_default: true } },
      );
      patch.is_default = true;
    }
    await existing.update(patch);
    return existing;
  }

  const envCount = await ctx.model.FtExecutionEnv.count({
    where: { project_code: fields.project_code },
  });
  fields.is_default = preferDefault || envCount === 0;
  if (fields.is_default) {
    await ctx.model.FtExecutionEnv.update(
      { is_default: false },
      { where: { project_code: fields.project_code, is_default: true } },
    );
  }
  fields.auth_configured = mergedAuth;
  return ctx.model.FtExecutionEnv.create(fields);
}

/**
 * @param {import('egg').Context} ctx
 * @param {string} projectCode
 * @param {string} name
 */
async function deleteSyncedExecutionEnv(ctx, projectCode, name) {
  const row = await ctx.model.FtExecutionEnv.findOne({
    where: { project_code: projectCode, name },
  });
  if (!row) return false;
  const auth = row.auth_configured || {};
  if (auth.sync_source !== SYNC_MARKER) return false;
  const wasDefault = row.is_default;
  await row.destroy();
  if (wasDefault) {
    const next = await ctx.model.FtExecutionEnv.findOne({
      where: { project_code: projectCode },
      order: [[ 'id', 'ASC' ]],
    });
    if (next) await next.update({ is_default: true });
  }
  return true;
}

/**
 * @param {import('egg').Context} ctx
 * @param {string} projectCode
 * @returns {Promise<number>}
 */
async function ensureProjectTemplatesSynced(ctx, projectCode) {
  const code = String(projectCode || '').trim();
  if (!code) return 0;

  const templates = await ctx.model.ProjectEnvTemplate.findAll({
    where: { project_code: code },
    order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
  });
  if (!templates.length) return 0;

  const hasDefault = await ctx.model.FtExecutionEnv.findOne({
    where: { project_code: code, is_default: true },
  });

  let synced = 0;
  for (let i = 0; i < templates.length; i += 1) {
    const raw = templates[i];
    const tpl = raw.toJSON ? raw.toJSON() : raw;
    await upsertExecutionEnvFromTemplate(ctx, tpl, {
      preferDefault: !hasDefault && i === 0,
    });
    synced += 1;
  }
  return synced;
}

module.exports = {
  SYNC_MARKER,
  mapTemplateToExecutionFields,
  upsertExecutionEnvFromTemplate,
  deleteSyncedExecutionEnv,
  ensureProjectTemplatesSynced,
};
