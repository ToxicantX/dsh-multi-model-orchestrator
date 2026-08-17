#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOKENS = {
  '__AGENT_A_PROVIDER__': 'agentAProvider',
  '__AGENT_A_MODEL__': 'agentAModel',
  '__AGENT_B_PROVIDER__': 'agentBProvider',
  '__AGENT_B_MODEL__': 'agentBModel',
}

function usage() {
  return [
    'Usage:',
    '  node src/install.mjs --agent-a-provider <provider> --agent-a-model <model> --agent-b-provider <provider> --agent-b-model <model>',
    '',
    'Options:',
    '  --preset-id <id>  Install directory name (default: multi-model-orchestrator)',
    '  --target <path>   Override the DSH preset directory',
    '  --force           Replace an existing installation',
    '  --help            Show this help',
  ].join('\n')
}

export function parseArgs(argv) {
  const options = { presetId: 'multi-model-orchestrator', force: false }
  const keys = new Map([
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

function yamlString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('Missing required option: ' + label)
  if (/\r|\n|\0/u.test(value)) throw new Error('Invalid newline in ' + label)
  return JSON.stringify(value)
}

export function renderTemplate(source, options) {
  let output = source
  for (const [token, key] of Object.entries(TOKENS)) {
    output = output.replaceAll(token, yamlString(options[key], key))
  }
  if (/__AGENT_[AB]_(?:PROVIDER|MODEL)__/u.test(output)) throw new Error('Unresolved template token')
  return output
}

export async function install(options, env = process.env) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dshHome = env.DSH_HOME || join(homedir(), '.dsh')
  const presetId = options.presetId || 'multi-model-orchestrator'
  if (!/^[a-z0-9][a-z0-9._-]*$/iu.test(presetId)) throw new Error('Invalid preset id: ' + presetId)
  const target = resolve(options.target || join(dshHome, '.agent-presets', presetId))
  const source = await readFile(join(root, 'preset', 'agent.cordis.yml'), 'utf8')
  const rendered = renderTemplate(source, options)
  const force = options.force === true
  await mkdir(target, { recursive: true })
  await writeFile(join(target, 'agent.cordis.yml'), rendered, { encoding: 'utf8', flag: force ? 'w' : 'wx' })
  await cp(join(root, 'preset', 'preset.yml'), join(target, 'preset.yml'), { force, errorOnExist: !force })
  return target
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) { console.log(usage()); process.exit(0) }
    const target = await install(options)
    console.log('Installed multi-model orchestrator at ' + target)
    console.log('Configure each provider API key and Base URL in DSH Settings > Models, then select this preset.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(usage())
    process.exitCode = 1
  }
}
