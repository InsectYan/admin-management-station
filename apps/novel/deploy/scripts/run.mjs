#!/usr/bin/env node
/**
 * 小说子应用任务调度。日常：ams-novel <命令>
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const deployDir = join(__dirname, '..')
const appRoot = join(deployDir, '..')
const repoRoot = join(appRoot, '..', '..')
const isWin = process.platform === 'win32'
const task = process.argv[2] || 'help'
const profile = ['novel']

const infraCompose = join(repoRoot, 'deploy', 'compose', 'infra.yml')
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

function runCompose(composeFile, composeArgs = []) {
  if (!existsSync(composeFile)) fail(`缺少 compose 文件: ${composeFile}`)
  if (isWin) {
    run(resolvePowerShell(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(__dirname, 'compose.ps1'), ...composeArgs], {
      env: { ...process.env, AMS_COMPOSE_FILE: composeFile },
    })
  } else {
    run('bash', [join(__dirname, 'compose.sh'), ...composeArgs], { env: { ...process.env, AMS_COMPOSE_FILE: composeFile } })
  }
}

function runPs1(ps1Rel) {
  const ps1 = join(__dirname, ps1Rel)
  if (!existsSync(ps1)) fail(`缺少 ${ps1}`)
  run(resolvePowerShell(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1])
}

function withProfile(args) {
  return ['--profile', ...profile, ...args]
}

function printHelp() {
  console.log(`小说子应用 (novel) — CLI

首次:
  cd apps/novel/deploy && npm link

用法:
  ams-novel local              启动 infra + novel 栈（profile novel）
  ams-novel local:infra        仅 DB + Redis
  ams-novel local:reset        清库重建
  ams-novel local:down         停止本栈

未 link:
  node apps/novel/deploy/scripts/run.mjs <命令>
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
    else runCompose(appCompose, withProfile(['up', '-d', '--build']))
    break
  case 'local:infra':
    runCompose(infraCompose, ['up', '-d'])
    break
  case 'local:reset':
    if (isWin) runPs1('reset-dev.ps1')
    else {
      runCompose(appCompose, withProfile(['down', '-v']))
      runCompose(appCompose, withProfile(['up', '-d', '--build']))
    }
    break
  case 'local:down':
    runCompose(appCompose, withProfile(['down']))
    break
  default:
    fail(`未知任务: ${task}\n运行 ams-novel help 查看命令列表`)
}
