import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import packageJson from '../package.json' with { type: 'json' }
import hostPlugin, { Config as HostConfig, ORCHESTRATOR_SETTINGS_ENDPOINT, ORCHESTRATOR_SETTINGS_NAMESPACE, AgentSettingsSchema, SettingsSchema, MultiModelOrchestratorSettings, apply as applyHost, inject as hostInject, settingsRoute } from '../host.js'
import { DEFAULT_AGENT_DESCRIPTION, normalizeAgents } from '../src/config.js'
import { install, parseArgs } from '../src/install.mjs'

const agent = (id, overrides = {}) => ({ id, provider: 'provider-' + id, model: 'model-' + id, description: 'Own ' + id + '.', ...overrides })

function settingsContext(initial = { agents: [] }) {
  let current = structuredClone(initial)
  let watched
  const registrations = []
  const ctx = {
    fiber: { state: 0 },
    reflect: { provide() {} },
    settings: { register(ns, schema, options) {
      registrations.push({ ns, schema, options })
      return { get: () => current, watch: callback => { watched = callback; return () => {} }, replace: async next => { const previous = current; current = structuredClone(next); await watched?.(current, previous) } }
    } },
    inject(_names, callback) { callback(ctx) },
    effect(callback) { return callback() },
  }
  return { ctx, registrations, set(next) { const previous = current; current = structuredClone(next); watched?.(current, previous) } }
}

test('installer copies exactly the fixed orchestrator preset and no agent data rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-install-'))
  try {
    const target = join(root, 'presets', 'multi-model-orchestrator')
    const result = await install({ target, force: false })
    assert.equal(result.target, target)
    const output = await readFile(join(target, 'agent.cordis.yml'), 'utf8')
    assert.equal((output.match(/^\s*- id: multi-model-orchestrator$/gmu) ?? []).length, 1)
    assert.equal((output.match(/^\s*name: ['"]dsh-multi-model-orchestrator\/agent['"]$/gmu) ?? []).length, 1)
    assert.doesNotMatch(output, /^\s+(?:agents|provider|model|apiKey|baseURL):/gim)
    assert.doesNotMatch(output, /(?:API[_ ]?KEY|BASEURL|apiKey|baseURL|provider:|model:)/iu)
    assert.equal((output.match(/dsh-multi-model-orchestrator\/agent/gu) ?? []).length, 1)
    assert.match(output, /You own requirement analysis, repository inspection, implementation planning, architecture decisions, task decomposition, integration, and final verification/)
    assert.match(output, /Delegate scoped development and adjustment work/)
    assert.match(output, /Require each child to inspect its own diff and run the focused tests, type checks, or build checks/)
    assert.match(output, /independently run the relevant final tests and builds/)
    assert.match(await readFile(join(target, 'preset.yml'), 'utf8'), /multi-model orchestrator/iu)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('parseArgs handles fixed installer flags and rejects invalid values', () => {
  assert.deepEqual(parseArgs([]), { presetId: 'multi-model-orchestrator', force: false })
  assert.deepEqual(parseArgs(['--force', '--preset-id', 'custom', '--target', 'C:/tmp/preset', '--help']), { presetId: 'custom', target: 'C:/tmp/preset', force: true, help: true })
  assert.throws(() => parseArgs(['--unknown']), /Unknown option/)
  assert.throws(() => parseArgs(['--target']), /Missing value/)
  assert.throws(() => parseArgs(['--preset-id', '--force']), /Missing value/)
})

test('normalizeAgents permits empty only with allowEmpty', () => {
  assert.deepEqual(normalizeAgents([], { allowEmpty: true }), [])
  assert.throws(() => normalizeAgents([]), /non-empty array/)
  assert.deepEqual(normalizeAgents([agent('solo', { reasoningEffort: 'high' })])[0], { ...agent('solo'), reasoningEffort: 'high' })
  assert.equal(normalizeAgents([{ id: 'defaulted', provider: 'p', model: 'm' }])[0].description, DEFAULT_AGENT_DESCRIPTION)
  assert.throws(() => normalizeAgents([agent('solo', { reasoningEffort: 'high\nlow' })]), /Invalid newline.*reasoningEffort/)
})

test('host exports a unique settings namespace and validates service snapshots', () => {
  assert.equal(String(ORCHESTRATOR_SETTINGS_NAMESPACE), 'multi-model-orchestrator')
  assert.equal(typeof AgentSettingsSchema, 'function')
  assert.equal(typeof SettingsSchema, 'function')
  assert.equal(hostPlugin, applyHost)
  assert.deepEqual(hostPlugin.inject, hostInject)
  assert.equal(hostPlugin.Config, HostConfig)
  const fake = settingsContext({ agents: [agent('solo')] })
  const service = new MultiModelOrchestratorSettings(fake.ctx, { agents: [], presetPath: undefined })
  assert.deepEqual(service.currentAgents(), [agent('solo')])
  fake.set({ agents: [] })
  assert.deepEqual(service.currentAgents(), [])
  fake.set({ agents: [{ id: 'bad id', provider: 'p', model: 'm' }] })
  assert.throws(() => service.currentAgents(), /Invalid agent id/)
  assert.equal(fake.registrations[0].ns, ORCHESTRATOR_SETTINGS_NAMESPACE)
})

test('host endpoint replaces only validated Agent settings', async () => {
  const fake = settingsContext({ agents: [agent('before')] })
  const service = new MultiModelOrchestratorSettings(fake.ctx, { agents: [], presetPath: undefined })
  assert.deepEqual(await service.replaceAgents([agent('after')]), [agent('after')])
  assert.equal(settingsRoute(service).path, ORCHESTRATOR_SETTINGS_ENDPOINT)
  await assert.rejects(() => service.replaceAgents([{ id: 'bad id', provider: 'p', model: 'm' }]), /Invalid agent id/)
})

test('host onChange touches an existing preset path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-change-'))
  try {
    const presetPath = join(root, 'agent.cordis.yml')
    await writeFile(presetPath, 'fixed')
    const before = (await stat(presetPath)).mtimeMs
    const fake = settingsContext({ agents: [] })
    new MultiModelOrchestratorSettings(fake.ctx, { agents: [], presetPath })
    await new Promise(resolve => setTimeout(resolve, 20))
    fake.set({ agents: [agent('new')] })
    const after = (await stat(presetPath)).mtimeMs
    assert.ok(after >= before)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('package declares bundle and client integration exports', () => {
  assert.deepEqual(packageJson.dsh.bundle, { patch: './cordis.patch.yml' })
  assert.deepEqual(packageJson.dsh.client.inject, [
    '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-api-remotes',
  ])
  assert.equal(packageJson.exports['./host'], './host.js')
  assert.equal(packageJson.exports['./agent'], './agent.js')
  assert.equal(packageJson.exports['./client'], './lib/client.js')
})
