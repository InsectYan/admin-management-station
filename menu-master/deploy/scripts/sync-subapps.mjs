#!/usr/bin/env node
/**
 * 扫描 project-sub/ 下子应用 manifest，同步 subapp_registry 与一级 menu_items。
 * 逻辑参考 agent-management-master PluginManager.loadAll：启动时全量扫描、幂等注册、卸载已移除子应用。
 *
 * 用法：
 *   node menu-master/deploy/scripts/sync-subapps.mjs
 *   ams-main sync:subapps
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const deployDir = join(__dirname, '..')
const appRoot = join(deployDir, '..')
const repoRoot = join(appRoot, '..')

const projectSubDir = process.env.PROJECT_SUB_DIR || join(repoRoot, 'project-sub')
const backendDir = join(appRoot, 'backend')

const REQUIRED_FIELDS = [
  'app_key',
  'microapp_name',
  'display_name',
  'route_prefix',
  'entry_dev',
]

function log(msg) {
  console.log(`[sync-subapps] ${msg}`)
}

function warn(msg) {
  console.warn(`[sync-subapps] ${msg}`)
}

function fail(msg, code = 1) {
  console.error(`[sync-subapps] ${msg}`)
  process.exit(code)
}

function loadPgClient() {
  const pgPath = join(backendDir, 'node_modules', 'pg')
  if (!existsSync(pgPath)) {
    fail(
      '未找到 backend/node_modules/pg，请先执行：cd menu-master/backend && npm install',
    )
  }
  const require = createRequire(import.meta.url)
  const { Client } = require(pgPath)
  return Client
}

function loadEnvFile(filePath) {
  const env = {}
  if (!existsSync(filePath)) return env
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function resolveDbConfig() {
  const deployEnv = loadEnvFile(join(deployDir, 'config', '.env.local'))
  const backendEnv = loadEnvFile(join(backendDir, '.env'))
  const merged = { ...deployEnv, ...backendEnv, ...process.env }

  return {
    host: merged.POSTGRES_HOST || '127.0.0.1',
    port: Number(merged.MAIN_POSTGRES_PORT || merged.POSTGRES_PORT || 5432),
    user: merged.POSTGRES_USER || 'admin',
    password: merged.POSTGRES_PASSWORD || 'admin123',
    database: merged.MAIN_POSTGRES_DB || merged.POSTGRES_DB || 'admin_platform',
  }
}

function validateManifest(manifest, dirName) {
  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      throw new Error(`${dirName}: manifest 缺少必填字段 ${field}`)
    }
  }
  if (!manifest.entry_prod) {
    manifest.entry_prod = `/subapps/${manifest.microapp_name}/`
  }
  if (manifest.menu_order == null) {
    manifest.menu_order = 99
  }
  if (!manifest.icon) {
    manifest.icon = 'icon-default'
  }
  if (!manifest.entry_env) {
    manifest.entry_env = `SUBAPP_${manifest.app_key.toUpperCase().replace(/-/g, '_')}_ENTRY`
  }
  return manifest
}

/**
 * 扫描 project-sub/，跳过 _ / . 开头目录及无 manifest 的目录。
 */
function scanSubApps() {
  const store = new Map()

  if (!existsSync(projectSubDir)) {
    warn(`目录不存在，跳过扫描: ${projectSubDir}`)
    return store
  }

  const entries = readdirSync(projectSubDir, { withFileTypes: true })
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    if (ent.name.startsWith('_') || ent.name.startsWith('.')) continue

    const appDir = join(projectSubDir, ent.name)
    const manifestPath = join(appDir, 'subapp.manifest.json')
    if (!existsSync(manifestPath)) {
      warn(`跳过无 subapp.manifest.json 的目录: ${ent.name}`)
      continue
    }

    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const manifest = validateManifest(raw, ent.name)
      store.set(manifest.microapp_name, { ...manifest, dirName: ent.name })
      log(`发现子应用: ${manifest.display_name} (${manifest.microapp_name}) ← ${ent.name}`)
    } catch (err) {
      warn(`加载失败 ${ent.name}: ${err.message}`)
    }
  }

  return store
}

async function waitForPostgres(dbConfig, maxAttempts = 30) {
  const Client = loadPgClient()
  for (let i = 1; i <= maxAttempts; i++) {
    const client = new Client(dbConfig)
    try {
      await client.connect()
      await client.end()
      return
    } catch {
      await client.end().catch(() => {})
      if (i === maxAttempts) {
        fail(`Postgres 未就绪 (${dbConfig.host}:${dbConfig.port})，请先 ams-main local:infra`)
      }
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

async function upsertSubapp(client, manifest) {
  await client.query(
    `INSERT INTO subapp_registry (
      microapp_name, app_key, display_name, entry_dev, entry_prod,
      vite_port, api_port, agent_port, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'enabled', NOW())
    ON CONFLICT (microapp_name) DO UPDATE SET
      app_key = EXCLUDED.app_key,
      display_name = EXCLUDED.display_name,
      entry_dev = EXCLUDED.entry_dev,
      entry_prod = EXCLUDED.entry_prod,
      vite_port = EXCLUDED.vite_port,
      api_port = EXCLUDED.api_port,
      agent_port = EXCLUDED.agent_port,
      status = 'enabled',
      updated_at = NOW()`,
    [
      manifest.microapp_name,
      manifest.app_key,
      manifest.display_name,
      manifest.entry_dev,
      manifest.entry_prod,
      manifest.vite_port ?? null,
      manifest.api_port ?? null,
      manifest.agent_port ?? null,
    ],
  )
}

async function upsertRootMenu(client, manifest) {
  const existing = await client.query(
    `SELECT id FROM menu_items
     WHERE microapp_name = $1 AND parent_id IS NULL
     LIMIT 1`,
    [manifest.microapp_name],
  )

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE menu_items SET
        name = $1,
        route_prefix = $2,
        status = 'enabled',
        "order" = $3,
        icon = $4,
        updated_at = NOW()
       WHERE id = $5`,
      [
        manifest.display_name,
        manifest.route_prefix,
        manifest.menu_order,
        manifest.icon,
        existing.rows[0].id,
      ],
    )
    return
  }

  await client.query(
    `INSERT INTO menu_items (
      name, parent_id, route_prefix, microapp_name, status, "order", icon, updated_at
    ) VALUES ($1, NULL, $2, $3, 'enabled', $4, $5, NOW())`,
    [
      manifest.display_name,
      manifest.route_prefix,
      manifest.microapp_name,
      manifest.menu_order,
      manifest.icon,
    ],
  )
}

async function disableRemoved(client, activeMicroapps) {
  const names = [...activeMicroapps]
  if (names.length === 0) {
    await client.query(
      `UPDATE subapp_registry SET status = 'disabled', updated_at = NOW()
       WHERE status = 'enabled'`,
    )
    await client.query(
      `UPDATE menu_items SET status = 'disabled', updated_at = NOW()
       WHERE parent_id IS NULL AND status = 'enabled'`,
    )
    return
  }

  await client.query(
    `UPDATE subapp_registry SET status = 'disabled', updated_at = NOW()
     WHERE status = 'enabled' AND microapp_name <> ALL($1::varchar[])`,
    [names],
  )
  await client.query(
    `UPDATE menu_items SET status = 'disabled', updated_at = NOW()
     WHERE parent_id IS NULL AND status = 'enabled' AND microapp_name <> ALL($1::varchar[])`,
    [names],
  )
}

function mergeEnvLines(filePath, updates) {
  const lines = existsSync(filePath) ? readFileSync(filePath, 'utf8').split('\n') : []
  const keyIndex = new Map()

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq <= 0) return
    keyIndex.set(trimmed.slice(0, eq).trim(), idx)
  })

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`
    if (keyIndex.has(key)) {
      lines[keyIndex.get(key)] = line
    } else {
      lines.push(line)
    }
  }

  const content = lines.join('\n').replace(/\n+$/, '') + '\n'
  writeFileSync(filePath, content, 'utf8')
}

function syncFrontendEnv(subapps) {
  const envPath = join(appRoot, 'frontend', '.env.local')
  const updates = {}
  for (const manifest of subapps.values()) {
    const viteKey = manifest.entry_env.startsWith('VITE_')
      ? manifest.entry_env
      : `VITE_${manifest.entry_env}`
    updates[viteKey] = manifest.entry_dev
  }
  if (Object.keys(updates).length === 0) return
  mergeEnvLines(envPath, updates)
  log(`已同步 frontend/.env.local 子应用 entry (${Object.keys(updates).length} 项)`)
}

function syncDeployEnv(subapps) {
  const envPath = join(deployDir, 'config', '.env.local')
  const updates = {}
  for (const manifest of subapps.values()) {
    updates[manifest.entry_env] = manifest.entry_dev
  }
  if (Object.keys(updates).length === 0) return
  mergeEnvLines(envPath, updates)
  log(`已同步 deploy/config/.env.local 子应用 entry (${Object.keys(updates).length} 项)`)
}

async function syncToDb(subapps) {
  const dbConfig = resolveDbConfig()
  await waitForPostgres(dbConfig)

  const Client = loadPgClient()
  const client = new Client(dbConfig)
  await client.connect()

  try {
    for (const manifest of subapps.values()) {
      await upsertSubapp(client, manifest)
      await upsertRootMenu(client, manifest)
    }
    await disableRemoved(client, subapps.keys())
  } finally {
    await client.end()
  }
}

async function main() {
  log(`扫描目录: ${projectSubDir}`)
  const subapps = scanSubApps()

  if (subapps.size === 0) {
    warn('未发现任何子应用，将禁用所有已注册子应用菜单')
  }

  await syncToDb(subapps)
  syncDeployEnv(subapps)
  syncFrontendEnv(subapps)

  log(`同步完成，共 ${subapps.size} 个子应用`)
  for (const m of subapps.values()) {
    log(`  · ${m.display_name} → /media/${m.route_prefix} (${m.entry_dev})`)
  }
}

main().catch(err => fail(err.message))
