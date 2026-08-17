#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeAgents } from './config.js'

const DEFAULT_PRESET_ID = 'multi-model-orchestrator'

function usage() {
  return [
    'Usage:',
    '  node src/install.mjs --config <agents.json> [--force]',
    '',
    'Legacy two-agent usage:',
    '  node src/install.mjs --agent-a-provider <provider> --agent-a-model <model> --agent-b-provider <provider> --agent-b-model <model>',
    '',
    'Options:',
    '  --config <path>   JSON file containing an agents array',
    '  --preset-id <id>  Install directory name (default: multi-model-orchestrator)',
    '  --target <path>   Override the DSH preset directory',
    '  --force           Replace an existing installation',
    '  --help            Show this help',
  ].join('\n')
}

export function parseArgs(argv) {
  const options = { presetId: DEFAULT_PRESET_ID, force: false }
  const keys = new Map([
    ['--config', 'config'],
    ['--agent-a-provider', 'agentAProvider'], ['--agent-a-model', 'agentAModel'],
    ['--agent-b-provider', 'agentBProvider'], ['--agent-b-model', 'agentBModel'],
    ['--preset-id', 'presetId'], ['--target', 'target'],
  ])
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--force') { options.force = true; continue }
    if (arg === '--help') { options.help = true; continue }
    const key = keys.get(arg)
    if (!key) throw new Error('Unknown option: ' + arg)
    const value = argv[++index]
    if (!value || value.startsWith('--')) throw new Error('Missing value for ' + arg)
    options[key] = value
  }
  return options
}

function legacyAgents(options) {
  const fields = ['agentAProvider', 'agentAModel', 'agentBProvider', 'agentBModel']
  if (fields.filter(key => options[key] !== undefined).length !== fields.length) throw new Error('Use --config, or provide all four legacy Agent A/B route options')
  return [
    { id: 'a', provider: options.agentAProvider, model: options.agentAModel, description: 'You are Agent A, the architecture and implementation specialist. Own the assigned scope, inspect the actual repository, implement or analyze rigorously, run focused verification, and report concrete results to the primary orchestrator.' },
    { id: 'b', provider: options.agentBProvider, model: options.agentBModel, description: 'You are Agent B, the independent engineering and review specialist. Challenge assumptions, test edge cases, and report concrete risks to the primary orchestrator.' },
  ]
}

export async function resolveAgents(options) {
  if (options.config === undefined) return normalizeAgents(options.agents ?? legacyAgents(options))
  if (options.agents !== undefined || ['agentAProvider', 'agentAModel', 'agentBProvider', 'agentBModel'].some(key => options[key] !== undefined)) throw new Error('--config cannot be combined with inline agent options')
  let document
  try {
    document = JSON.parse(await readFile(resolve(options.config), 'utf8'))
  } catch (error) {
    throw new Error('Cannot read agent config ' + options.config + ': ' + (error instanceof Error ? error.message : String(error)))
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)) throw new Error('Agent config must be a JSON object')
  return normalizeAgents(document.agents)
}

function yamlString(value) { return JSON.stringify(value) }

function renderPluginRow(agents) {
  const rows = [
    '    - id: multi-model-orchestrator',
    "      name: 'dsh-multi-model-orchestrator'",
    '      config:',
    '        agents:',
  ]
  for (const agent of agents) {
    rows.push(
      '          - id: ' + yamlString(agent.id),
      '            provider: ' + yamlString(agent.provider),
      '            model: ' + yamlString(agent.model),
      '            description: ' + yamlString(agent.description),
      ...(agent.maxTokens === undefined ? [] : ['            maxTokens: ' + agent.maxTokens]),
    )
  }
  return rows.join('\n')
}

export function renderTemplate(source, input) {
  const agents = normalizeAgents(input)
  const output = source.replace('__ORCHESTRATOR_PLUGIN_ROW__', renderPluginRow(agents))
  if (/__(?:ORCHESTRATOR|SUBAGENT)_[A-Z_]+__/u.test(output)) throw new Error('Unresolved template token')
  return output
}

export async function install(options, env = process.env) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dshHome = env.DSH_HOME || join(homedir(), '.dsh')
  const presetId = options.presetId || DEFAULT_PRESET_ID
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(presetId)) throw new Error('Invalid preset id: ' + presetId)
  const target = resolve(options.target || join(dshHome, '.agent-presets', presetId))
  const source = await readFile(join(root, 'preset', 'agent.cordis.yml'), 'utf8')
  const agents = await resolveAgents(options)
  const rendered = renderTemplate(source, agents)
  const force = options.force === true
  await mkdir(target, { recursive: true })
  await writeFile(join(target, 'agent.cordis.yml'), rendered, { encoding: 'utf8', flag: force ? 'w' : 'wx' })
  await cp(join(root, 'preset', 'preset.yml'), join(target, 'preset.yml'), { force, errorOnExist: !force })
  return { target, agents }
}

// Package-manager bin shims can reach this file through a symlinked path.
const isMain = basename(process.argv[1] ?? '') === 'install.mjs'
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) { console.log(usage()); process.exit(0) }
    const result = await install(options)
    console.log('Installed plugin-backed orchestrator with ' + result.agents.length + ' subagent(s) at ' + result.target)
    console.log('The dsh-multi-model-orchestrator package must also be installed in the active DSH profile.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(usage())
    process.exitCode = 1
  }
}
