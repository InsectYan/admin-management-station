#!/usr/bin/env node
/**
 * npm link 后删除全局 bin 目录中的 .ps1 shim。
 * PowerShell 会优先执行 .ps1，在 Restricted 执行策略下会导致 ams-* 无法运行。
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const deployDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(deployDir, 'package.json'), 'utf8'))
const binName = Object.keys(pkg.bin || {})[0]

if (!binName) {
  process.exit(0)
}

const prefixResult = spawnSync('npm', ['prefix', '-g'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
if (prefixResult.status !== 0) {
  console.error('无法获取 npm 全局 prefix，跳过删除 .ps1 shim')
  process.exit(0)
}

const ps1Path = join(prefixResult.stdout.trim(), `${binName}.ps1`)
if (existsSync(ps1Path)) {
  unlinkSync(ps1Path)
  console.log(`Removed ${ps1Path}`)
}
