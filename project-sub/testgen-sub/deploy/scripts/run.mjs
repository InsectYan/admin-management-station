#!/usr/bin/env node
/**
 * AI智能测试平台子应用（自包含）任务调度。日常：ams-testgen <命令>
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const deployDir = join(__dirname, '..')
const appRoot = join(deployDir, '..')
const isWin = process.platform === 'win32'
const task = process.argv[2] || 'help'

const appCompose = join(deployDir, 'docker-compose.yml')

function fail(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

let cachedPowerShell = null

function resolvePowerShell() {
  if (cachedPowerShell) return cachedPowerShell
  for (const exe of ['pwsh', join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'), 'powershell.exe']) {
    const probe = spawnSync(exe, ['-NoLogo', '-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore', shell: false })
    if (!probe.error && probe.status === 0) {
      cachedPowerShell = exe
      return cachedPowerShell
    }
  }
  cachedPowerShell = 'powershell.exe'
  return cachedPowerShell
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts })
  if (r.error) fail(`${cmd} ${args.join(' ')}: ${r.error.message}`)
  process.exit(r.status ?? 1)
}

function runCompose(composeArgs = []) {
  if (!existsSync(appCompose)) fail(`缺少 compose 文件: ${appCompose}`)
  if (isWin) {
    run(resolvePowerShell(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(__dirname, 'compose.ps1'), ...composeArgs], {
      env: { ...process.env, AMS_COMPOSE_FILE: appCompose },
    })
  } else {
    run('bash', [join(__dirname, 'compose.sh'), ...composeArgs], { env: { ...process.env, AMS_COMPOSE_FILE: appCompose } })
  }
}

function runPs1(ps1Rel) {
  const ps1 = join(__dirname, ps1Rel)
  if (!existsSync(ps1)) fail(`缺少 ${ps1}`)
  run(resolvePowerShell(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1])
}

function runNodeBackendScript(scriptArgs) {
  const backendDir = join(appRoot, 'backend')
  const envLocal = join(deployDir, 'config', '.env.local')
  const env = { ...process.env }
  if (existsSync(envLocal)) {
    try {
      const text = readFileSync(envLocal, 'utf8')
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch { /* ignore */ }
  }
  if (!env.POSTGRES_PORT && env.TESTGEN_POSTGRES_PORT) {
    env.POSTGRES_PORT = env.TESTGEN_POSTGRES_PORT
  }
  const r = spawnSync(process.execPath, scriptArgs, { cwd: backendDir, env, stdio: 'inherit', shell: false })
  if (r.error) fail(r.error.message)
  process.exit(r.status ?? 1)
}

function printHelp() {
  console.log(`AI智能测试平台 (testgen-sub) — 自包含 CLI

首次:
  cd testgen-sub/deploy && npm link

用法:
  ams-testgen local              启动 Postgres + API + 前端
  ams-testgen local:infra        仅 Postgres（宿主机热更新业务代码）
  ams-testgen local:reset        清库重建
  ams-testgen local:down         停止本栈

Fitness 数据库（须 Postgres 已启动，默认端口见 deploy/config/.env.local）:
  ams-testgen db                 同步 Schema（含自动补列）+ 全量注入
  ams-testgen db:seed            同上（全量）
  ams-testgen db:seed <表名>     同步 Schema + 仅注入指定表
  ams-testgen db:sync            仅同步 Schema（不含数据）

db 流程：对比 init.sql 自动 ADD COLUMN → enrich data.json 中文名 → 外键顺序注入
字段中文标签：database/display-labels.json

未 link:
  node testgen-sub/deploy/scripts/run.mjs <命令>
`)
}

switch (task) {
  case 'help':
  case '-h':
  case '--help':
    printHelp()
    process.exit(0)
    break
  case 'local':
    if (isWin) runPs1('start-local.ps1')
    else runCompose(['up', '-d', '--build'])
    break
  case 'local:infra':
    runCompose(['up', '-d', 'postgres'])
    break
  case 'local:reset':
    if (isWin) runPs1('reset-dev.ps1')
    else {
      runCompose(['down', '-v'])
      runCompose(['up', '-d', '--build'])
    }
    break
  case 'local:down':
    runCompose(['down'])
    break
  case 'db':
    runNodeBackendScript([join('scripts', 'db-cli.js'), 'all'])
    break
  case 'db:sync':
    runNodeBackendScript([join('scripts', 'db-cli.js'), 'sync'])
    break
  case 'db:seed': {
    const tableName = process.argv[3]
    const args = [ join('scripts', 'db-cli.js'), 'seed' ]
    if (tableName) args.push(tableName)
    runNodeBackendScript(args)
    break
  }
  default:
    fail(`未知任务: ${task}\n运行 ams-testgen help 查看命令列表`)
}
