#!/usr/bin/env node
import { basename } from 'node:path'
import { provisionPreset, defaultPresetTarget, DEFAULT_PRESET_ID } from './preset.js'

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

export function install(options = {}) {
  const presetId = options.presetId ?? DEFAULT_PRESET_ID
  const target = options.target ?? defaultPresetTarget(presetId)
  return provisionPreset({ target, presetId, force: options.force })
}

const isMain = basename(process.argv[1] ?? '') === 'install.mjs'
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) { console.log(usage()); process.exit(0) }
    const result = install(options)
    console.log((result.changed.length === 0 ? 'Preset is already current at ' : 'Provisioned the multi-model orchestrator preset at ') + result.target)
    console.log('Open DSH Settings > Orchestrator to configure agents from existing models.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(usage())
    process.exitCode = 1
  }
}
