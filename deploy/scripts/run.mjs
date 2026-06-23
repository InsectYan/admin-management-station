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
const isWin = process.platform === 'win32'
const task = process.argv[2] || 'help'

function fail(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts })
  if (r.error) fail(`${cmd} ${args.join(' ')}: ${r.error.message}`)
  process.exit(r.status ?? 1)
}

function runPs1(ps1Rel, psArgs = []) {
  const ps1 = join(__dirname, ps1Rel)
  if (!existsSync(ps1)) fail(`缺少 ${ps1}`)
  return run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ps1,
    ...psArgs,
  ])
}

function printHelp() {
  console.log(`admin-management-station — CLI（对齐 cartoon-agent）

首次（每台机器一次）:
  cd deploy && npm link

用法:
  ams <命令>

本地 Docker:
  ams local              启动全栈（DB + Redis + API + 前端 + Agent）
  ams local:frontend     仅前端容器
  ams local:infra        仅 DB + Redis（业务代码宿主机热更新）
  ams local:reset        清库重建 + 冒烟
  ams local:down         停止本地 Docker

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
    if (isWin) runPs1('start-local.ps1')
    else run('bash', [join(__dirname, 'start-local.sh')])
    break
  case 'local:infra':
    if (isWin) runPs1('compose.ps1', ['--profile', 'infra', 'up', '-d'])
    else run('bash', [join(__dirname, 'compose.sh'), '--profile', 'infra', 'up', '-d'])
    break
  case 'local:frontend':
    if (isWin) runPs1('compose.ps1', ['up', '-d', '--build', 'main-frontend', 'novel-frontend'])
    else run('bash', [join(__dirname, 'compose.sh'), 'up', '-d', '--build', 'main-frontend', 'novel-frontend'])
    break
  case 'local:reset':
    if (isWin) runPs1('reset-dev.ps1')
    else run('bash', [join(__dirname, 'reset-dev.sh')])
    break
  case 'local:down':
    if (isWin) runPs1('compose.ps1', ['--profile', 'local', 'down'])
    else run('bash', [join(__dirname, 'compose.sh'), '--profile', 'local', 'down'])
    break
  default:
    fail(`未知任务: ${task}\n运行 ams help 查看命令列表`)
}
