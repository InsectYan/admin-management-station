#!/usr/bin/env node
/**
 * 任务调度核心。日常入口：ams <命令>（deploy 目录 npm link 一次）
 * 开发调试：node deploy/scripts/run.mjs <命令>
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const deployDir = join(__dirname, '..')
const repoRoot = join(deployDir, '..')
const isWin = process.platform === 'win32'
const task = process.argv[2] || 'help'

const composeFiles = {
  all: join(deployDir, 'docker-compose.yml'),
  infra: join(deployDir, 'compose', 'infra.yml'),
  main: join(repoRoot, 'menu-master', 'docker-compose.yml'),
  novel: join(repoRoot, 'apps', 'novel', 'docker-compose.yml'),
  agent: join(repoRoot, 'apps', 'agent-server', 'docker-compose.yml'),
}

function fail(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

/** @type {string | null} */
let cachedPowerShell = null

function resolvePowerShell() {
  if (cachedPowerShell) return cachedPowerShell
  if (process.env.AMS_PWSH && existsSync(process.env.AMS_PWSH)) {
    cachedPowerShell = process.env.AMS_PWSH
    return cachedPowerShell
  }
  const candidates = [
    'pwsh',
    join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'PowerShell', '7', 'pwsh.exe'),
    'powershell.exe',
  ]
  for (const exe of candidates) {
    const probe = spawnSync(exe, ['-NoLogo', '-NoProfile', '-Command', 'exit 0'], {
      stdio: 'ignore',
      shell: false,
    })
    if (!probe.error && probe.status === 0) {
      cachedPowerShell = exe
      return cachedPowerShell
    }
  }
  cachedPowerShell = 'powershell.exe'
  return cachedPowerShell
}

function winEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    CHCP: '65001',
  }
}

function runPowerShell(scriptPath, psArgs = [], extraEnv = {}) {
  return run(resolvePowerShell(), [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...psArgs,
  ], { env: winEnv(extraEnv) })
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...opts.env },
    ...opts,
  })
  if (r.error) fail(`${cmd} ${args.join(' ')}: ${r.error.message}`)
  process.exit(r.status ?? 1)
}

function runCompose(composeKey, composeArgs = []) {
  const composeFile = composeFiles[composeKey]
  if (!composeFile || !existsSync(composeFile)) {
    fail(`缺少 compose 文件 (${composeKey}): ${composeFile}`)
  }
  if (isWin) {
    runPowerShell(join(__dirname, 'compose.ps1'), composeArgs, {
      AMS_COMPOSE_FILE: composeFile,
    })
  } else {
    run('bash', [join(__dirname, 'compose.sh'), ...composeArgs], {
      env: { AMS_COMPOSE_FILE: composeFile },
    })
  }
}

function runPs1(ps1Rel, psArgs = []) {
  const ps1 = join(__dirname, ps1Rel)
  if (!existsSync(ps1)) fail(`缺少 ${ps1}`)
  return runPowerShell(ps1, psArgs)
}

function printHelp() {
  console.log(`admin-management-station — CLI（对齐 cartoon-agent）

首次（每台机器一次）:
  cd deploy && npm link

用法:
  ams <命令>

本地 Docker（根编排 deploy/docker-compose.yml include 各应用）:
  ams local              启动主应用栈（infra + menu-master）
  ams local:all          启动全栈（含 --profile novel --profile agent）
  ams local:main         仅主应用（menu-master/docker-compose.yml）
  ams local:novel        仅小说子应用（需 --profile novel）
  ams local:agent        仅 Agent（需 --profile agent）
  ams local:infra        仅 DB + Redis
  ams local:frontend     仅重建主应用前端容器
  ams local:reset        清库重建 + 冒烟
  ams local:down         停止根编排栈

单应用目录内也可直接:
  cd menu-master && docker compose up -d --build
  cd apps/novel && docker compose --profile novel up -d --build

未 link 时（仓库根目录）:
  node deploy/scripts/run.mjs <命令>
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
  case 'local:main':
    if (isWin) runPs1('start-local.ps1')
    else runCompose('main', ['up', '-d', '--build'])
    break
  case 'local:all':
    runCompose('all', ['up', '-d', '--build', '--profile', 'novel', '--profile', 'agent'])
    break
  case 'local:infra':
    runCompose('infra', ['up', '-d'])
    break
  case 'local:novel':
    runCompose('novel', ['--profile', 'novel', 'up', '-d', '--build'])
    break
  case 'local:agent':
    runCompose('agent', ['--profile', 'agent', 'up', '-d', '--build'])
    break
  case 'local:frontend':
    runCompose('main', ['up', '-d', '--build', 'main-frontend'])
    break
  case 'local:reset':
    if (isWin) runPs1('reset-dev.ps1')
    else run('bash', [join(__dirname, 'reset-dev.sh')])
    break
  case 'local:down':
    runCompose('all', ['down'])
    break
  default:
    fail(`未知任务: ${task}\n运行 ams help 查看命令列表`)
}
