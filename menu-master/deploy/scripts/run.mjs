#!/usr/bin/env node
/**
 * 主应用任务调度。日常：ams-main <命令>
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
  const candidates = [
    'pwsh',
    join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
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

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts })
  if (r.error) fail(`${cmd} ${args.join(' ')}: ${r.error.message}`)
  process.exit(r.status ?? 1)
}

function runCompose(composeFile, composeArgs = []) {
  if (!existsSync(composeFile)) fail(`缺少 compose 文件: ${composeFile}`)
  if (isWin) {
    run(resolvePowerShell(), [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      join(__dirname, 'compose.ps1'),
      ...composeArgs,
    ], { env: { ...process.env, AMS_COMPOSE_FILE: composeFile } })
  } else {
    run('bash', [join(__dirname, 'compose.sh'), ...composeArgs], {
      env: { ...process.env, AMS_COMPOSE_FILE: composeFile },
    })
  }
}

function runPs1(ps1Rel, psArgs = []) {
  const ps1 = join(__dirname, ps1Rel)
  if (!existsSync(ps1)) fail(`缺少 ${ps1}`)
  run(resolvePowerShell(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...psArgs])
}

function printHelp() {
  console.log(`主应用 (menu-master) — CLI

首次（每台机器一次）:
  cd menu-master/deploy && npm link

用法:
  ams-main <命令>

本地 Docker:
  ams-main local              启动 Postgres + Redis + API + 前端
  ams-main local:frontend     仅重建前端容器
  ams-main local:infra        仅 Postgres + Redis（宿主机热更新）
  ams-main local:reset        清库重建
  ams-main local:down         停止本栈

未 link:
  node menu-master/deploy/scripts/run.mjs <命令>
`)
}

const appCompose = join(deployDir, 'docker-compose.yml')

switch (task) {
  case 'help':
  case '-h':
  case '--help':
    printHelp()
    process.exit(0)
    break
  case 'local':
    if (isWin) runPs1('start-local.ps1')
    else runCompose(appCompose, ['up', '-d', '--build'])
    break
  case 'local:frontend':
    if (isWin) runPs1('start-local-frontend.ps1')
    else run('bash', [join(__dirname, 'start-local-frontend.sh')])
    break
  case 'local:infra':
    runCompose(appCompose, ['up', '-d', 'postgres', 'redis'])
    break
  case 'local:reset':
    if (isWin) runPs1('reset-dev.ps1')
    else {
      runCompose(appCompose, ['down', '-v'])
      runCompose(appCompose, ['up', '-d', '--build'])
    }
    break
  case 'local:down':
    runCompose(appCompose, ['down'])
    break
  default:
    fail(`未知任务: ${task}\n运行 ams-main help 查看命令列表`)
}
