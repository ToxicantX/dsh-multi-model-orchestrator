#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PRESET_ID = 'multi-model-orchestrator'
const root = dirname(dirname(fileURLToPath(import.meta.url)))

function usage() {
  return [
    'Usage:',
    '  dsh-orchestrator-install [--force]',
    '',
    'Options:',
    '  --preset-id <id>  Install directory name (default: multi-model-orchestrator)',
    '  --target <path>   Override the DSH preset directory',
    '  --force           Replace an existing installation',
    '  --help            Show this help',
    '',
    'Configure agents afterward in DSH Settings > Orchestrator.',
  ].join('\n')
}

export function parseArgs(argv) {
  const options = { presetId: DEFAULT_PRESET_ID, force: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--force') { options.force = true; continue }
    if (arg === '--help') { options.help = true; continue }
    if (arg !== '--preset-id' && arg !== '--target') throw new Error('Unknown option: ' + arg)
    const value = argv[++index]
    if (!value || value.startsWith('--')) throw new Error('Missing value for ' + arg)
    options[arg === '--preset-id' ? 'presetId' : 'target'] = value
  }
  return options
}

export async function install(options = {}) {
  const presetId = options.presetId ?? DEFAULT_PRESET_ID
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(presetId)) throw new Error('Invalid preset id: ' + presetId)
  const target = options.target ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), '.agent-presets', presetId)
  await mkdir(target, { recursive: true })
  const agentPreset = await readFile(join(root, 'preset', 'agent.cordis.yml'), 'utf8')
  await writeFile(join(target, 'agent.cordis.yml'), agentPreset, { encoding: 'utf8', flag: options.force ? 'w' : 'wx' })
  await cp(join(root, 'preset', 'preset.yml'), join(target, 'preset.yml'), { force: options.force, errorOnExist: !options.force })
  return { target }
}

// Package-manager bin shims can reach this file through a symlinked path.
const isMain = basename(process.argv[1] ?? '') === 'install.mjs'
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) { console.log(usage()); process.exit(0) }
    const result = await install(options)
    console.log('Installed the fixed multi-model orchestrator preset at ' + result.target)
    console.log('Open DSH Settings > Orchestrator to configure agents from existing models.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(usage())
    process.exitCode = 1
  }
}
