import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import packageJson from '../package.json' with { type: 'json' }
import hostPlugin, { Config as HostConfig, ORCHESTRATOR_SETTINGS_ENDPOINT, ORCHESTRATOR_SETTINGS_NAMESPACE, AgentSettingsSchema, SettingsSchema, MultiModelOrchestratorSettings, apply as applyHost, inject as hostInject, settingsRoute } from '../host.js'
import { DEFAULT_AGENT_DESCRIPTION, MAX_AGENT_COUNT, normalizeAgents } from '../src/config.js'
import { install, parseArgs } from '../src/install.mjs'
import { LEGACY_PRESET_ID, PRESET_MARKER, provisionLegacyPreset, provisionPreset } from '../src/preset.js'

const agent = (id, overrides = {}) => ({ id, provider: 'provider-' + id, model: 'model-' + id, description: 'Own ' + id + '.', ...overrides })

function settingsContext(initial = { agents: [] }) {
  let current = structuredClone(initial)
  let watched
  const registrations = []
  const provided = new Map()
  const routes = []
  const ctx = {
    fiber: { state: 0 },
    reflect: { provide() {} },
    provide(name, value) { provided.set(name, value) },
    webServer: { register(route) { routes.push(route); return () => {} } },
    settings: { register(ns, schema, options) {
      registrations.push({ ns, schema, options })
      return { get: () => current, watch: callback => { watched = callback; return () => {} }, replace: async next => { const previous = current; current = structuredClone(next); await watched?.(current, previous) } }
    } },
    inject(_names, callback) { callback(ctx) },
    effect(callback) { return callback() },
  }
  return { ctx, registrations, provided, routes, set(next) { const previous = current; current = structuredClone(next); watched?.(current, previous) } }
}

async function invokeSettingsRoute(service, { method = 'GET', origin, contentType, body } = {}) {
  const req = Readable.from(body === undefined ? [] : [body])
  req.method = method
  req.headers = {
    host: '127.0.0.1:60316',
    ...(origin === undefined ? {} : { origin }),
    ...(contentType === undefined ? {} : { 'content-type': contentType }),
  }
  let status
  let headers
  let output = ''
  const res = {
    writeHead(nextStatus, nextHeaders) { status = nextStatus; headers = nextHeaders },
    end(value = '') { output += value },
  }
  await settingsRoute(service).handler(req, res)
  return { status, headers, value: JSON.parse(output) }
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
    assert.match(output, /configured roster of up to three development specialists as available execution capacity/)
    assert.match(output, /Act as the product\/project manager/)
    assert.match(output, /Own the outcome, acceptance criteria, decomposition, assignment, integration, and final acceptance/)
    assert.match(output, /Specialists own development/)
    assert.match(output, /clarify outcomes and acceptance criteria before implementation/)
    assert.match(output, /Map every meaningful separable scope to the best-fit available specialist/)
    assert.match(output, /different specialist for each concurrently executable scope/)
    assert.match(output, /Dispatch all independent matched scopes together, up to the available specialist count/)
    assert.match(output, /Do not keep a suitable specialist idle while you perform development/)
    assert.match(output, /only when no meaningful matching scope exists or its work depends on unfinished results/)
    assert.match(output, /Never invent work merely to use every specialist/)
    assert.match(output, /exclusively owns its assigned scope and acceptance target until it settles/)
    assert.match(output, /Never implement or run equivalent tests for a target a child owns/)
    assert.match(output, /Continue only clearly non-overlapping management or integration work/)
    assert.match(output, /run_in_background: false when the next step depends on that child/)
    assert.match(output, /Wait for prerequisites before starting dependent work/)
    assert.match(output, /Reuse the same continuable child for follow-up on the same task/)
    assert.match(output, /run final acceptance checks/)
    assert.match(output, /Handle a trivial one-step change entirely yourself/)
    assert.match(output, /When no specialists are configured, do the work yourself/)
    assert.doesNotMatch(output, /file ownership|Do not delegate these responsibilities|fixed delegation ratio/u)
    assert.match(await readFile(join(target, 'preset.yml'), 'utf8'), /multi-model orchestrator/iu)
    assert.deepEqual((await readdir(target)).sort(), [PRESET_MARKER, 'agent.cordis.yml', 'preset.yml'].sort())
    assert.equal(result.compatibility.target, join(root, 'presets', LEGACY_PRESET_ID))
    assert.equal(result.compatibility.skipped, false)
    assert.equal(await readFile(join(result.compatibility.target, 'agent.cordis.yml'), 'utf8'), output)
    assert.match(await readFile(join(result.compatibility.target, 'preset.yml'), 'utf8'), /Compatibility alias for sessions created with the legacy orchestrator preset ID[.]/u)
    assert.deepEqual((await readdir(result.compatibility.target)).sort(), [PRESET_MARKER, 'agent.cordis.yml', 'preset.yml'].sort())
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('legacy compatibility provisioning preserves unmanaged preset directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-compatibility-'))
  try {
    const primaryTarget = join(root, 'presets', 'multi-model-orchestrator')
    const legacyTarget = join(root, 'presets', LEGACY_PRESET_ID)
    await mkdir(legacyTarget, { recursive: true })
    await writeFile(join(legacyTarget, 'agent.cordis.yml'), 'user-owned preset\n')
    const result = await install({ target: primaryTarget, force: false })
    assert.equal(result.compatibility.skipped, true)
    assert.equal(result.compatibility.reason, 'existing-unmanaged')
    assert.equal(await readFile(join(legacyTarget, 'agent.cordis.yml'), 'utf8'), 'user-owned preset\n')
    assert.deepEqual((await readdir(legacyTarget)).sort(), ['agent.cordis.yml'])

    const direct = provisionLegacyPreset({ primaryTarget })
    assert.equal(direct.skipped, true)
    assert.equal(direct.reason, 'existing-unmanaged')

    const managedPrimary = join(root, 'managed', 'multi-model-orchestrator')
    const managed = provisionLegacyPreset({ primaryTarget: managedPrimary })
    await writeFile(join(managed.target, 'preset.yml'), 'user-edited metadata\n')
    const preserved = provisionLegacyPreset({ primaryTarget: managedPrimary })
    assert.equal(preserved.skipped, true)
    assert.equal(preserved.reason, 'managed-content-changed')
    assert.equal(await readFile(join(managed.target, 'preset.yml'), 'utf8'), 'user-edited metadata\n')

    const oldPrimary = join(root, 'upgrade', 'multi-model-orchestrator')
    const oldLegacy = join(root, 'upgrade', LEGACY_PRESET_ID)
    provisionPreset({ target: oldLegacy, presetId: LEGACY_PRESET_ID })
    const upgraded = provisionLegacyPreset({ primaryTarget: oldPrimary })
    assert.equal(upgraded.skipped, false)
    assert.deepEqual(upgraded.changed, ['preset.yml'])
    assert.match(await readFile(join(oldLegacy, 'preset.yml'), 'utf8'), /Compatibility alias for sessions created with the legacy orchestrator preset ID[.]/u)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('legacy compatibility adopts an exact historical unmarked preset', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-historical-legacy-'))
  try {
    const primaryTarget = join(root, 'multi-model-orchestrator')
    const target = join(root, LEGACY_PRESET_ID)
    await mkdir(target, { recursive: true })
    const historical = {
      'agent.cordis.yml': 'historical official agent preset\n',
      'preset.yml': 'historical official metadata\n',
    }
    for (const [name, content] of Object.entries(historical)) await writeFile(join(target, name), content)
    const legacyBundles = [Object.fromEntries(Object.entries(historical).map(([name, content]) => [name, createHash('sha256').update(content).digest('hex')]))]

    const adopted = provisionLegacyPreset({ primaryTarget, legacyBundles })
    assert.equal(adopted.skipped, false)
    assert.equal(adopted.adopted, true)
    assert.equal(adopted.migrated, true)
    assert.deepEqual(adopted.changed, ['agent.cordis.yml', 'preset.yml', PRESET_MARKER])
    assert.equal(await readFile(join(target, 'agent.cordis.yml'), 'utf8'), await readFile(new URL('../preset-legacy/agent.cordis.yml', import.meta.url), 'utf8'))
    assert.equal(await readFile(join(target, 'preset.yml'), 'utf8'), await readFile(new URL('../preset-legacy/preset.yml', import.meta.url), 'utf8'))

    const current = provisionLegacyPreset({ primaryTarget, legacyBundles })
    assert.equal(current.skipped, false)
    assert.deepEqual(current.changed, [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('provisioner is idempotent, adopts legacy content, and preserves unrelated files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-provision-'))
  try {
    const target = join(root, 'preset')
    const first = provisionPreset({ target })
    assert.deepEqual(first.changed, ['agent.cordis.yml', 'preset.yml', PRESET_MARKER])
    await writeFile(join(target, 'unrelated.txt'), 'keep')
    const second = provisionPreset({ target })
    assert.deepEqual(second.changed, [])
    assert.equal(await readFile(join(target, 'unrelated.txt'), 'utf8'), 'keep')
    const legacy = join(root, 'legacy')
    await (await import('node:fs/promises')).mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, 'agent.cordis.yml'), await readFile(join(target, 'agent.cordis.yml')))
    await writeFile(join(legacy, 'preset.yml'), await readFile(join(target, 'preset.yml')))
    const adopted = provisionPreset({ target: legacy })
    assert.equal(adopted.adopted, true)
    assert.ok((await stat(join(legacy, PRESET_MARKER))).isFile())
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('provisioner migrates a known unmarked bundle without accepting edited content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-legacy-'))
  try {
    const sourceDir = join(root, 'source')
    const target = join(root, 'legacy')
    await mkdir(sourceDir, { recursive: true })
    await mkdir(target, { recursive: true })
    const legacy = {
      'agent.cordis.yml': 'legacy agent preset\n',
      'preset.yml': 'legacy metadata\n',
    }
    for (const [name, content] of Object.entries(legacy)) {
      await writeFile(join(sourceDir, name), 'current ' + content)
      await writeFile(join(target, name), content)
    }
    await writeFile(join(target, 'unrelated.txt'), 'keep')
    const legacyBundles = [Object.fromEntries(Object.entries(legacy).map(([name, content]) => [name, createHash('sha256').update(content).digest('hex')]))]
    const result = provisionPreset({ target, sourceDir, legacyBundles })
    assert.equal(result.adopted, true)
    assert.equal(result.migrated, true)
    assert.deepEqual(result.changed, ['agent.cordis.yml', 'preset.yml', PRESET_MARKER])
    assert.equal(await readFile(join(target, 'agent.cordis.yml'), 'utf8'), 'current legacy agent preset\n')
    assert.equal(await readFile(join(target, 'preset.yml'), 'utf8'), 'current legacy metadata\n')
    assert.equal(await readFile(join(target, 'unrelated.txt'), 'utf8'), 'keep')

    const edited = join(root, 'edited')
    await mkdir(edited, { recursive: true })
    await writeFile(join(edited, 'agent.cordis.yml'), legacy['agent.cordis.yml'])
    await writeFile(join(edited, 'preset.yml'), 'user edit\n')
    assert.throws(() => provisionPreset({ target: edited, sourceDir, legacyBundles }), /does not match.*--force/u)
    assert.equal(await readFile(join(edited, 'agent.cordis.yml'), 'utf8'), legacy['agent.cordis.yml'])
    await assert.rejects(readFile(join(edited, PRESET_MARKER)), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('provisioner safely completes partial targets and refuses edited content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-partial-'))
  try {
    const target = join(root, 'partial')
    await (await import('node:fs/promises')).mkdir(target, { recursive: true })
    const sourceTarget = join(root, 'source')
    provisionPreset({ target: sourceTarget })
    await writeFile(join(target, 'agent.cordis.yml'), await readFile(join(sourceTarget, 'agent.cordis.yml')))
    const partial = provisionPreset({ target })
    assert.deepEqual(partial.changed, ['preset.yml', PRESET_MARKER])
    const edited = join(root, 'edited')
    provisionPreset({ target: edited })
    const before = await readFile(join(edited, 'preset.yml'))
    await writeFile(join(edited, 'preset.yml'), 'edited')
    assert.throws(() => provisionPreset({ target: edited }), /preset.yml.*packaged|--force/u)
    assert.equal(await readFile(join(edited, 'agent.cordis.yml'), 'utf8'), await readFile(join(sourceTarget, 'agent.cordis.yml'), 'utf8'))
    assert.notEqual(await readFile(join(edited, 'preset.yml'), 'utf8'), before.toString())

    const conflicting = join(root, 'conflicting-unmanaged')
    await mkdir(conflicting, { recursive: true })
    await writeFile(join(conflicting, 'agent.cordis.yml'), 'custom content')
    assert.throws(() => provisionPreset({ target: conflicting }), /does not match.*--force/u)
    await assert.rejects(readFile(join(conflicting, 'preset.yml')), { code: 'ENOENT' })
    await assert.rejects(readFile(join(conflicting, PRESET_MARKER)), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('provisioner safely upgrades content while managed files still match their marker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-upgrade-'))
  try {
    const packaged = join(root, 'packaged')
    provisionPreset({ target: packaged })
    const sourceDir = join(root, 'source')
    await mkdir(sourceDir, { recursive: true })
    await writeFile(join(sourceDir, 'agent.cordis.yml'), await readFile(join(packaged, 'agent.cordis.yml')))
    await writeFile(join(sourceDir, 'preset.yml'), await readFile(join(packaged, 'preset.yml')))
    const target = join(root, 'target')
    provisionPreset({ target, sourceDir })
    await writeFile(join(sourceDir, 'preset.yml'), 'name: Updated preset\n')
    const upgraded = provisionPreset({ target, sourceDir })
    assert.deepEqual(upgraded.changed, ['preset.yml'])
    assert.equal(await readFile(join(target, 'preset.yml'), 'utf8'), 'name: Updated preset\n')
    assert.deepEqual(provisionPreset({ target, sourceDir }).changed, [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('provisioner repairs missing files, rejects invalid markers, and force repairs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-repair-'))
  try {
    const target = join(root, 'target')
    provisionPreset({ target })
    await rm(join(target, 'preset.yml'))
    const restored = provisionPreset({ target })
    assert.deepEqual(restored.changed, ['preset.yml'])
    await writeFile(join(target, PRESET_MARKER), '{}')
    assert.throws(() => provisionPreset({ target }), /marker.*invalid|foreign|--force/u)
    const forced = provisionPreset({ target, force: true })
    assert.deepEqual(forced.changed, ['agent.cordis.yml', 'preset.yml', PRESET_MARKER])
    const marker = JSON.parse(await readFile(join(target, PRESET_MARKER), 'utf8'))
    marker.managedBy = 'another-package'
    await writeFile(join(target, PRESET_MARKER), JSON.stringify(marker))
    assert.throws(() => provisionPreset({ target }), /foreign or invalid.*--force/u)
    await writeFile(join(target, PRESET_MARKER), 'null')
    assert.throws(() => provisionPreset({ target }), /foreign or invalid.*--force/u)
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
  assert.equal(MAX_AGENT_COUNT, 3)
  const maximum = Array.from({ length: MAX_AGENT_COUNT }, (_, index) => agent('agent-' + index))
  assert.equal(normalizeAgents(maximum, { allowEmpty: true }).length, 3)
  const tooMany = [...maximum, agent('overflow')]
  assert.throws(() => normalizeAgents(tooMany, { allowEmpty: true }), /must not contain more than 3 entries/)
  assert.equal(normalizeAgents(tooMany, { allowEmpty: true, allowOverLimit: true }).length, 4)
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

test('host preserves an oversized legacy roster while activating only three Agents', async () => {
  const legacy = Array.from({ length: MAX_AGENT_COUNT + 1 }, (_, index) => agent('legacy-' + index))
  const fake = settingsContext({ agents: legacy })
  const service = new MultiModelOrchestratorSettings(fake.ctx, { agents: [], presetPath: undefined })

  assert.doesNotThrow(() => fake.registrations[0].options.validate({ agents: legacy }))
  assert.deepEqual(service.configuredAgents(), legacy)
  assert.deepEqual(service.currentAgents(), legacy.slice(0, MAX_AGENT_COUNT))
  assert.deepEqual((await invokeSettingsRoute(service)).value.agents, legacy)
  await assert.rejects(() => service.replaceAgents(legacy), /must not contain more than 3 entries/)
})

test('host endpoint replaces only validated Agent settings', async () => {
  const fake = settingsContext({ agents: [agent('before')] })
  const service = new MultiModelOrchestratorSettings(fake.ctx, { agents: [], presetPath: undefined })
  assert.deepEqual(await service.replaceAgents([agent('after')]), [agent('after')])
  assert.equal(settingsRoute(service).path, ORCHESTRATOR_SETTINGS_ENDPOINT)
  await assert.rejects(() => service.replaceAgents([{ id: 'bad id', provider: 'p', model: 'm' }]), /Invalid agent id/)
})

test('host settings route enforces origin, method, media type, shape, size, and normalization', async () => {
  const fake = settingsContext({ agents: [agent('before')] })
  const service = new MultiModelOrchestratorSettings(fake.ctx, { agents: [], presetPath: undefined })

  const get = await invokeSettingsRoute(service)
  assert.equal(get.status, 200)
  assert.deepEqual(get.value, { agents: [agent('before')] })
  assert.match(get.headers['content-type'], /^application\/json/u)
  assert.deepEqual((await invokeSettingsRoute(service, { method: 'HEAD' })).value, {})
  assert.equal((await invokeSettingsRoute(service, { origin: 'https://example.test' })).status, 403)
  assert.equal((await invokeSettingsRoute(service, { method: 'POST' })).status, 405)
  assert.equal((await invokeSettingsRoute(service, { method: 'PUT', contentType: 'text/plain', body: '{}' })).status, 415)
  assert.equal((await invokeSettingsRoute(service, { method: 'PUT', contentType: 'application/json', body: '{' })).status, 400)
  assert.equal((await invokeSettingsRoute(service, { method: 'PUT', contentType: 'application/json', body: JSON.stringify({ agents: [], extra: true }) })).status, 400)
  assert.match((await invokeSettingsRoute(service, { method: 'PUT', contentType: 'application/json', body: JSON.stringify({ agents: [], padding: 'x'.repeat(64 * 1024) }) })).value.error, /exceeds 64 KiB/)

  const maximum = Array.from({ length: MAX_AGENT_COUNT }, (_, index) => agent('agent-' + index))
  const accepted = await invokeSettingsRoute(service, { method: 'PUT', contentType: 'application/json; charset=utf-8', body: JSON.stringify({ agents: maximum }) })
  assert.equal(accepted.status, 200)
  const tooMany = [...maximum, agent('overflow')]
  const limited = await invokeSettingsRoute(service, { method: 'PUT', contentType: 'application/json; charset=utf-8', body: JSON.stringify({ agents: tooMany }) })
  assert.equal(limited.status, 400)
  assert.match(limited.value.error, /must not contain more than 3 entries/)

  const replacement = agent('after', { id: ' after ' })
  const put = await invokeSettingsRoute(service, { method: 'PUT', contentType: 'application/json', body: JSON.stringify({ agents: [replacement] }) })
  assert.equal(put.status, 200)
  assert.equal(put.value.agents[0].id, 'after')
})

test('host activation provisions the preset before registering its service and route', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orchestrator-host-provision-'))
  try {
    const target = join(root, 'multi-model-orchestrator')
    const presetPath = join(target, 'agent.cordis.yml')
    const fake = settingsContext({ agents: [] })
    applyHost(fake.ctx, { agents: [], presetPath })
    assert.ok((await stat(presetPath)).isFile())
    assert.ok((await stat(join(target, 'preset.yml'))).isFile())
    assert.ok((await stat(join(target, PRESET_MARKER))).isFile())
    assert.ok((await stat(join(root, LEGACY_PRESET_ID, 'agent.cordis.yml'))).isFile())
    assert.ok((await stat(join(root, LEGACY_PRESET_ID, PRESET_MARKER))).isFile())
    assert.ok(fake.provided.has('multiModelOrchestrator'))
    assert.equal(fake.routes[0].path, ORCHESTRATOR_SETTINGS_ENDPOINT)
  } finally { await rm(root, { recursive: true, force: true }) }
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
  assert.ok(packageJson.files.includes('src/preset.js'))
  assert.ok(packageJson.files.includes('preset-legacy/'))
})
