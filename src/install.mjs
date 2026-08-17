#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PRESET_ID = 'multi-model-orchestrator'
const AGENT_ID = /^[a-z][a-z0-9_-]{0,47}$/u

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

function requiredString(value, label, maxLength = 512) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('Missing required field: ' + label)
  const clean = value.trim()
  if (/\r|\n|\0/u.test(clean)) throw new Error('Invalid newline in ' + label)
  if (clean.length > maxLength) throw new Error(label + ' exceeds ' + maxLength + ' characters')
  return clean
}

export function normalizeAgents(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('agents must be a non-empty array')
  const ids = new Set()
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error('agents[' + index + '] must be an object')
    const id = requiredString(entry.id, 'agents[' + index + '].id', 48)
    if (!AGENT_ID.test(id)) throw new Error('Invalid agent id: ' + id)
    if (ids.has(id)) throw new Error('Duplicate agent id: ' + id)
    ids.add(id)
    const provider = requiredString(entry.provider, 'agents[' + index + '].provider')
    const model = requiredString(entry.model, 'agents[' + index + '].model')
    const fallback = 'You are the ' + id + ' specialist. Own the assigned scope, inspect the actual repository, work rigorously, run focused verification, and report concrete results, risks, and unresolved questions to the primary orchestrator.'
    const description = entry.description === undefined ? fallback : requiredString(entry.description, 'agents[' + index + '].description', 2000)
    return { id, provider, model, description }
  })
}

function legacyAgents(options) {
  const fields = ['agentAProvider', 'agentAModel', 'agentBProvider', 'agentBModel']
  const present = fields.filter(key => options[key] !== undefined)
  if (present.length !== fields.length) throw new Error('Use --config, or provide all four legacy Agent A/B route options')
  return [
    { id: 'a', provider: options.agentAProvider, model: options.agentAModel, description: 'You are Agent A, the architecture and implementation specialist. Own the assigned scope, inspect the actual repository, implement or analyze rigorously, run focused verification, and report concrete changed files, test results, risks, and unresolved questions to the primary orchestrator.' },
    { id: 'b', provider: options.agentBProvider, model: options.agentBModel, description: 'You are Agent B, the independent engineering and review specialist. Inspect the assigned scope independently, implement or challenge assumptions as requested, run focused verification, and report concrete findings, changed files, test results, risks, and unresolved questions to the primary orchestrator.' },
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

function renderAgentRows(agents) {
  return agents.map(agent => [
    '    - id: tool-subagent-' + agent.id,
    "      name: '@deepseek-ai/dsh-tool-subagent'",
    '      config:',
    '        provider: spawn',
    '        toolName: subagent_' + agent.id,
    '        backgroundMode: continuable',
    '        agentOptions:',
    '          provider: ' + yamlString(agent.provider),
    '          model: ' + yamlString(agent.model),
    '        persona: ' + yamlString(agent.description),
    '        maxDepth: 1',
  ].join('\n')).join('\n\n')
}

function renderGuidance(agents) {
  return ['      Available specialists:', ...agents.map(agent => '      - subagent_' + agent.id + ': ' + agent.description)].join('\n')
}

export function renderTemplate(source, input) {
  const agents = normalizeAgents(input)
  const output = source
    .replace('__SUBAGENT_GUIDANCE__', renderGuidance(agents))
    .replace('__SUBAGENT_ROWS__', renderAgentRows(agents))
  if (/__SUBAGENT_(?:GUIDANCE|ROWS)__/u.test(output)) throw new Error('Unresolved template token')
  return output
}

export async function install(options, env = process.env) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dshHome = env.DSH_HOME || join(homedir(), '.dsh')
  const presetId = options.presetId || DEFAULT_PRESET_ID
  if (!/^[a-z0-9][a-z0-9._-]*$/iu.test(presetId)) throw new Error('Invalid preset id: ' + presetId)
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

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) { console.log(usage()); process.exit(0) }
    const result = await install(options)
    console.log('Installed multi-model orchestrator with ' + result.agents.length + ' subagent(s) at ' + result.target)
    console.log('Configure each provider API key and Base URL in DSH Settings > Models, then select this preset.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(usage())
    process.exitCode = 1
  }
}
